import { Prisma } from "@prisma/client";
import prisma from "../../../core/databases/prisma";
import { paginate } from "../../../core/utils/paginate";
import {
   AttendanceFilterParams,
   applyPostFetchFilters,
   buildAttendanceWhere,
   inferServiceOrder,
   SessionServiceLite,
   isLateAttendance,
} from "../utils/attendanceFilters";
import { addHours } from "../utils/time";

export interface ServiceInput {
   order: number;
   serviceTime: Date;
   preServiceTime?: Date | null;
   closesAt?: Date | null;
}

export interface StartSessionInput {
   serviceName: string;
   startedAt: Date;
   date?: Date;
   serviceDayId?: string | null;
   specialProgramId?: string | null;
   services: ServiceInput[];
}

export interface UpdateSessionInput {
   serviceName?: string;
   startedAt?: Date;
   date?: Date;
   serviceDayId?: string | null;
   specialProgramId?: string | null;
   services?: ServiceInput[];
}

// Helper: a session loaded with the relations every caller needs.
const sessionInclude = {
   services: { orderBy: { order: "asc" as const } },
   serviceDay: true,
   specialProgram: true,
   attendees: {
      include: { user: { include: { departments: true } } },
   },
} satisfies Prisma.AttendanceSessionInclude;

const normaliseService = (s: ServiceInput) => ({
   order: s.order,
   serviceTime: s.serviceTime,
   preServiceTime: s.preServiceTime ?? null,
   closesAt: s.closesAt ?? null,
});

const toLite = (s: {
   order: number;
   serviceTime: Date;
   preServiceTime: Date | null;
   closesAt: Date | null;
}): SessionServiceLite => ({
   order: s.order,
   serviceTime: s.serviceTime,
   preServiceTime: s.preServiceTime,
   closesAt: s.closesAt,
});

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
const VISITOR_TO_MEMBER_THRESHOLD = 3;

/**
 * Auto-promote churchStatus after an attendance mark.
 *   FIRST_TIMER  → VISITOR  (always, on first mark)
 *   VISITOR      → MEMBER   (when ≥ {@link VISITOR_TO_MEMBER_THRESHOLD}
 *                            attendances in the last 4 weeks, inclusive of
 *                            the just-created mark).
 * Silent: callers don't surface the change; the next read of the user
 * reflects it. Admin-edited statuses still work — this only fires upward.
 */
async function promoteChurchStatusIfDue(userId: string): Promise<void> {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { churchStatus: true },
   });
   if (!user) return;

   if (user.churchStatus === "FIRST_TIMER") {
      await prisma.user.update({
         where: { id: userId },
         data: { churchStatus: "VISITOR" },
      });
      return;
   }

   if (user.churchStatus === "VISITOR") {
      const since = new Date(Date.now() - FOUR_WEEKS_MS);
      const recentCount = await prisma.attendance.count({
         where: { userId, markedAt: { gte: since } },
      });
      if (recentCount >= VISITOR_TO_MEMBER_THRESHOLD) {
         await prisma.user.update({
            where: { id: userId },
            data: { churchStatus: "MEMBER" },
         });
      }
   }
}

export class AttendanceService {
   async startSession(input: StartSessionInput) {
      const {
         serviceName,
         startedAt,
         date,
         serviceDayId,
         specialProgramId,
         services,
      } = input;

      // Prevent duplicate sessions for same startedAt + service
      const existing = await prisma.attendanceSession.findFirst({
         where: { startedAt, serviceName },
      });
      if (existing)
         throw new Error("Session already exists for this date and service");

      if (serviceDayId && specialProgramId) {
         throw new Error(
            "Session can only link to one of serviceDay or specialProgram, not both",
         );
      }

      return await prisma.attendanceSession.create({
         data: {
            serviceName,
            startedAt,
            date: date ?? null,
            serviceDayId: serviceDayId ?? null,
            specialProgramId: specialProgramId ?? null,
            services: {
               create: services.map(normaliseService),
            },
         },
         include: sessionInclude,
      });
   }

   async markAttendance(
      sessionId: string,
      userId: string,
      markedAt?: Date,
      serviceOrderOverride?: number,
   ) {
      const session = await prisma.attendanceSession.findUnique({
         where: { id: sessionId },
         include: { services: { orderBy: { order: "asc" } } },
      });
      if (!session) throw new Error("Attendance session not found");

      // Check if already marked
      const alreadyMarked = await prisma.attendance.findFirst({
         where: { sessionId, userId },
      });
      if (alreadyMarked) throw new Error("User already marked present");

      const effectiveMarkedAt = markedAt ?? new Date();
      const orders = new Set(session.services.map((s) => s.order));
      const serviceOrder =
         serviceOrderOverride && orders.has(serviceOrderOverride)
            ? serviceOrderOverride
            : inferServiceOrder(
                 effectiveMarkedAt,
                 session.services.map(toLite),
              );

      await prisma.attendance.create({
         data: { sessionId, userId, markedAt: effectiveMarkedAt, serviceOrder },
         include: { user: true },
      });

      await promoteChurchStatusIfDue(userId);

      return { success: true, serviceOrder };
   }

   async getAllSessions(page = 1, limit = 10) {
      return await paginate(prisma.attendanceSession, {
         page,
         limit,
         include: {
            services: { orderBy: { order: "asc" } },
            serviceDay: true,
            specialProgram: true,
            attendees: { include: { user: true } },
         },
         // Order by creation time descending so the list groups (item #7) read
         // newest-first inside each ServiceDay / SpecialProgram section.
         orderBy: { createdAt: "desc" },
      });
   }

   async getSessionById(
      sessionId: string,
      filters: AttendanceFilterParams = {},
   ) {
      const session = await prisma.attendanceSession.findUnique({
         where: { id: sessionId },
         include: {
            services: {
               orderBy: { order: "asc" },
               include: { incomes: true },
            },
            serviceDay: true,
            specialProgram: true,
            attendees: {
               where: buildAttendanceWhere(filters),
               include: {
                  user: { include: { departments: true } },
               },
            },
         },
      });

      if (!session) throw new Error("Attendance session not found");

      const filteredAttendees = applyPostFetchFilters(
         session.attendees,
         filters,
         session.services.map(toLite),
      );

      return { ...session, attendees: filteredAttendees };
   }

   // bulk session update - add 12hrs to markedAt for all attendances in a session
   async bulkSessionUpdate(sessionId: string) {
      const session = await this.getSessionById(sessionId);

      if (!session) return;

      const attendees = session.attendees;
      const sessionStartedAt = session.startedAt;

      attendees.forEach((attendee) => {
         const attendeeMarkedAt = attendee.markedAt;
         const diffMs = sessionStartedAt.getTime() - attendeeMarkedAt.getTime();
         const diffHours = diffMs / (1000 * 60 * 60);

         if (diffHours >= 10 && diffHours <= 13) {
            attendee.markedAt = addHours(attendeeMarkedAt.toISOString(), 12);
         }
      });

      await prisma.$transaction(
         attendees.map((attendee) =>
            prisma.attendance.update({
               where: {
                  id: attendee.id,
               },
               data: {
                  markedAt: attendee.markedAt,
               },
            }),
         ),
      );

      return { attendees };
   }

   async updateSession(sessionId: string, data: UpdateSessionInput) {
      const { services, serviceDayId, specialProgramId, ...rest } = data;

      // Swapping the parent link: if either is set explicitly to a value, the
      // other side must be cleared so a session never points at both. The
      // caller passes one or the other; never both populated.
      if (serviceDayId && specialProgramId) {
         throw new Error(
            "Session can only link to one of serviceDay or specialProgram, not both",
         );
      }
      const linkPatch: {
         serviceDayId?: string | null;
         specialProgramId?: string | null;
      } = {};
      if (serviceDayId !== undefined) {
         linkPatch.serviceDayId = serviceDayId;
         if (serviceDayId !== null) linkPatch.specialProgramId = null;
      }
      if (specialProgramId !== undefined) {
         linkPatch.specialProgramId = specialProgramId;
         if (specialProgramId !== null) linkPatch.serviceDayId = null;
      }

      // When a services array is provided, replace the whole set.
      return await prisma.$transaction(async (tx) => {
         if (services && services.length > 0) {
            await tx.sessionService.deleteMany({ where: { sessionId } });
            await tx.sessionService.createMany({
               data: services.map((s) => ({
                  ...normaliseService(s),
                  sessionId,
               })),
            });
         }
         return tx.attendanceSession.update({
            where: { id: sessionId },
            data: { ...rest, ...linkPatch },
            include: sessionInclude,
         });
      });
   }

   async bulkMarkAttendance(sessionId: string, userIds: string[]) {
      const session = await prisma.attendanceSession.findUnique({
         where: { id: sessionId },
         include: { services: { orderBy: { order: "asc" } } },
      });
      if (!session) throw new Error("Attendance session not found");

      const existing = await prisma.attendance.findMany({
         where: { sessionId, userId: { in: userIds } },
         select: { userId: true },
      });
      const alreadyMarkedIds = new Set(existing.map((a) => a.userId));

      const toMark = userIds.filter((id) => !alreadyMarkedIds.has(id));

      if (toMark.length > 0) {
         const now = new Date();
         const serviceOrder = inferServiceOrder(
            now,
            session.services.map(toLite),
         );
         await prisma.attendance.createMany({
            data: toMark.map((userId) => ({
               sessionId,
               userId,
               markedAt: now,
               serviceOrder,
            })),
         });
         // Sequential (not parallel) — the count query in the promotion helper
         // depends on the row we just inserted being visible. Per-row work is
         // tiny (two indexed queries), so this is fine for bulk sizes typical
         // of a single church service.
         for (const userId of toMark) {
            await promoteChurchStatusIfDue(userId);
         }
      }

      return {
         marked: toMark.length,
         alreadyPresent: alreadyMarkedIds.size,
      };
   }

   async deleteSession(sessionId: string) {
      return await prisma.attendanceSession.delete({
         where: { id: sessionId },
      });
   }

   async updateAttendance(
      attendanceId: string,
      data: { markedAt?: Date; serviceOrder?: number },
   ) {
      if (data.serviceOrder !== undefined) {
         // Make sure the requested serviceOrder actually exists on the parent session.
         const row = await prisma.attendance.findUnique({
            where: { id: attendanceId },
            select: {
               sessionId: true,
               session: { select: { services: { select: { order: true } } } },
            },
         });
         if (!row) throw new Error("Attendance not found");
         const valid = row.session.services.some(
            (s) => s.order === data.serviceOrder,
         );
         if (!valid) {
            throw new Error(
               `Service order ${data.serviceOrder} does not exist on this session`,
            );
         }
      }

      return await prisma.attendance.update({
         where: { id: attendanceId },
         data: {
            ...(data.markedAt !== undefined ? { markedAt: data.markedAt } : {}),
            ...(data.serviceOrder !== undefined
               ? { serviceOrder: data.serviceOrder }
               : {}),
         },
         include: { user: { include: { departments: true } } },
      });
   }

   async deleteAttendance(attendanceId: string) {
      return await prisma.attendance.delete({
         where: { id: attendanceId },
      });
   }

   async getAttendanceSummary() {
      const [totalSessions, totalAttendanceRecords, uniqueAttendees] =
         await Promise.all([
            prisma.attendanceSession.count(),
            prisma.attendance.count(),
            prisma.attendance.groupBy({ by: ["userId"] }).then((r) => r.length),
         ]);

      const avgAttendancePerSession =
         totalSessions > 0
            ? Math.round(totalAttendanceRecords / totalSessions)
            : 0;

      return { totalSessions, uniqueAttendees, avgAttendancePerSession };
   }

   // async getTopMembers(limit = 10) {
   //   const grouped = await prisma.attendance.groupBy({
   //     by: ['userId'],
   //     _count: { userId: true },
   //     orderBy: { _count: { userId: 'desc' } },
   //     take: limit,
   //   });

   //   const userIds = grouped.map(g => g.userId);
   //   const users = await prisma.user.findMany({
   //     where: { id: { in: userIds } },
   //     select: { id: true, firstName: true, lastName: true, email: true, churchStatus: true },
   //   });

   //   const userMap = new Map(users.map(u => [u.id, u]));

   //   return grouped.map(g => ({
   //     ...userMap.get(g.userId),
   //     attendanceCount: g._count.userId,
   //   }));
   // }

   async getTopMembers(limit?: number) {
      const grouped = await prisma.attendance.groupBy({
         by: ["userId"],
         _count: {
            userId: true,
         },
         orderBy: {
            _count: {
               userId: "desc",
            },
         },
         ...(limit ? { take: limit } : {}),
      });

      const userIds = grouped.map((g) => g.userId);

      const users = await prisma.user.findMany({
         where: {
            id: {
               in: userIds,
            },
         },
         select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            churchStatus: true,
         },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return grouped.map((g) => ({
         ...userMap.get(g.userId),
         attendanceCount: g._count.userId,
      }));
   }

   async getMemberAttendanceHistory(userId: string) {
      return await prisma.attendance.findMany({
         where: { userId },
         include: {
            session: {
               select: { id: true, serviceName: true, startedAt: true },
            },
         },
         orderBy: { markedAt: "asc" },
      });
   }

   async getAttendanceTrend(
      groupBy: "session" | "week" | "month" = "session",
      departmentId?: string,
   ) {
      if (groupBy === "session") {
         const attendeesCount = departmentId
            ? {
                 where: {
                    user: { departments: { some: { id: departmentId } } },
                 },
              }
            : true;

         const sessions = await prisma.attendanceSession.findMany({
            include: {
               _count: { select: { attendees: attendeesCount } },
               serviceDay: { select: { id: true, name: true, weekday: true } },
            },
            orderBy: { startedAt: "asc" },
         });

         return sessions.map((s) => ({
            period: s.startedAt.toISOString(),
            label: s.serviceName,
            count: s._count.attendees,
            serviceDayId: s.serviceDay?.id ?? null,
            serviceDayName: s.serviceDay?.name ?? null,
            weekday: s.serviceDay?.weekday ?? null,
         }));
      }

      const interval = groupBy === "week" ? "week" : "month";

      const results: { period: Date; count: bigint }[] = departmentId
         ? await prisma.$queryRaw`
          SELECT date_trunc(${interval}, a."markedAt") AS period,
                 COUNT(*)::bigint AS count
          FROM "Attendance" a
          JOIN "_UserDepartments" ud ON ud."B" = a."userId"
          WHERE ud."A" = ${departmentId}
          GROUP BY period
          ORDER BY period
        `
         : await prisma.$queryRaw`
          SELECT date_trunc(${interval}, "markedAt") AS period,
                 COUNT(*)::bigint AS count
          FROM "Attendance"
          GROUP BY period
          ORDER BY period
        `;

      return results.map((r) => ({
         period: new Date(r.period).toISOString(),
         label: interval,
         count: Number(r.count),
      }));
   }

   async getAttendanceRate() {
      const [totalMembers, sessions] = await Promise.all([
         prisma.user.count(),
         prisma.attendanceSession.findMany({
            include: { _count: { select: { attendees: true } } },
            orderBy: { startedAt: "asc" },
         }),
      ]);

      return sessions.map((s) => ({
         sessionId: s.id,
         serviceName: s.serviceName,
         date: s.startedAt.toISOString(),
         attendeeCount: s._count.attendees,
         totalMembers,
         rate:
            totalMembers > 0
               ? Math.round((s._count.attendees / totalMembers) * 100)
               : 0,
      }));
   }
   async getConsecutiveAbsentees(limit?: number) {
      const sessions = await prisma.attendanceSession.findMany({
         where: {
            endedAt: {
               not: null,
            },
         },
         orderBy: {
            date: "desc",
         },
         select: {
            id: true,
         },
      });

      if (!sessions.length) return [];

      const attendances = await prisma.attendance.findMany({
         select: {
            userId: true,
            sessionId: true,
         },
      });

      const attendanceMap = new Map<string, Set<string>>();

      for (const attendance of attendances) {
         if (!attendanceMap.has(attendance.userId)) {
            attendanceMap.set(attendance.userId, new Set());
         }

         attendanceMap.get(attendance.userId)!.add(attendance.sessionId);
      }

      const users = await prisma.user.findMany({
         select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            churchStatus: true,
         },
      });

      const results = users
         .map((user) => {
            const attendedSessions =
               attendanceMap.get(user.id) ?? new Set<string>();

            let consecutiveAbsences = 0;

            for (const session of sessions) {
               if (!attendedSessions.has(session.id)) {
                  consecutiveAbsences++;
               } else {
                  break;
               }
            }

            return {
               ...user,
               consecutiveAbsences,
            };
         })
         .filter((user) => user.consecutiveAbsences > 0)
         .sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);

      return limit ? results.slice(0, limit) : results;
   }
   async getConsecutiveLateComers(limit?: number) {
      const sessions = await prisma.attendanceSession.findMany({
         where: {
            endedAt: {
               not: null,
            },
         },
         orderBy: {
            date: "desc",
         },
         include: {
            services: {
               orderBy: {
                  order: "asc",
               },
               select: {
                  order: true,
                  serviceTime: true,
                  preServiceTime: true,
                  closesAt: true,
               },
            },
            attendees: {
               include: {
                  user: {
                     select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        churchStatus: true,
                        membershipType: true,
                     },
                  },
               },
            },
         },
      });

      if (sessions.length === 0) {
         return [];
      }

      const users = await prisma.user.findMany({
         select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            churchStatus: true,
            membershipType: true,
         },
      });

      const results = users.map((user) => {
         let consecutiveLateCount = 0;

         for (const session of sessions) {
            const attendance = session.attendees.find(
               (a) => a.userId === user.id,
            );

            // Didn't attend -> streak ends
            if (!attendance) {
               break;
            }

            const serviceByOrder = new Map(
               session.services.map((service) => [service.order, service]),
            );

            const service =
               serviceByOrder.get(attendance.serviceOrder) ??
               session.services[0];

            if (!service) {
               break;
            }

            const late = isLateAttendance(
               attendance.markedAt,
               attendance.user.membershipType,
               service,
            );

            if (!late) {
               break;
            }

            consecutiveLateCount++;
         }

         return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            churchStatus: user.churchStatus,
            consecutiveLateCount,
         };
      });

      results.sort((a, b) => b.consecutiveLateCount - a.consecutiveLateCount);

      const filtered = results.filter((r) => r.consecutiveLateCount > 0);

      return limit ? filtered.slice(0, limit) : filtered;
   }
}
