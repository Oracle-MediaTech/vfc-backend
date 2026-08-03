import { Response } from "express";
import prisma from "../../../core/databases/prisma";
import {
  AttendanceFilterParams,
  applyPostFetchFilters,
  buildAttendanceWhere,
} from "../utils/attendanceFilters";
import { buildSessionReportDocDefinition } from "../pdf/sessionReport";

// pdfmake v0.3 ships as a singleton with no bundled types in this version.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require("pdfmake");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const robotoFonts = require("pdfmake/fonts/Roboto");
pdfmake.setFonts(robotoFonts);

const sanitizeFilename = (s: string) =>
  s.replace(/[^a-z0-9_\-]+/gi, "_").replace(/^_+|_+$/g, "") || "session";

export class AttendancePdfService {
  /**
   * Generate the session attendance PDF and stream it to `res`.
   * Throws when the session is missing; the route's `next(err)` will surface a 4xx/5xx.
   */
  async streamSessionReport(
    sessionId: string,
    filters: AttendanceFilterParams,
    requestingUserId: string,
    res: Response
  ): Promise<void> {
    const [session, settings, generatedBy, allWorkers] = await Promise.all([
      prisma.attendanceSession.findUnique({
        where: { id: sessionId },
        include: {
          services: {
            orderBy: { order: "asc" },
            include: { incomes: true },
          },
          attendees: {
            where: buildAttendanceWhere(filters),
            include: { user: { include: { departments: true } } },
          },
        },
      }),
      prisma.churchSettings.findUnique({ where: { id: "singleton" } }),
      prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { firstName: true, lastName: true },
      }),
      // All workers in the church — we'll subtract present userIds to get the
      // missed-workers list for the report's "Missed Workers" section.
      prisma.user.findMany({
        where: { membershipType: "WORKER" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          phoneNumber: true,
          departments: { select: { id: true, name: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

    if (!session) throw new Error("Attendance session not found");

    // Fetch per-department late-time overrides for this session's ServiceDay
    // (if any). SpecialProgram sessions don't carry a ServiceDay, so they get
    // no per-dept overrides — the global session cutoff still applies.
    const deptLateOverrides = session.serviceDayId
      ? await prisma.serviceDayDepartmentLateTime.findMany({
        where: { serviceDayId: session.serviceDayId },
        include: { department: { select: { id: true, name: true } } },
      })
      : [];

    const services = session.services.map((s) => ({
      order: s.order,
      serviceTime: s.serviceTime,
      preServiceTime: s.preServiceTime,
      closesAt: s.closesAt,
    }));

    // Flatten the income tree into the shape sessionReport expects.
    const incomes = session.services.flatMap((s) =>
      s.incomes.map((i) => ({
        serviceOrder: s.order,
        category: i.category,
        method: i.method,
        // Prisma Decimal serializes via toString; coerce to number for the PDF
        // builder (amounts are small enough that float precision is fine).
        amount: Number(i.amount),
      })),
    );

    const filteredAttendees = applyPostFetchFilters(session.attendees, filters, services);

    // Missed workers = all workers minus the ones present in THIS session.
    // We use the unfiltered attendee set for the subtraction so filters on the
    // report (e.g. department picker) don't accidentally inflate "missed".
    const presentUserIds = new Set(session.attendees.map((a) => a.userId));
    const missedWorkers = allWorkers
      .filter((w) => !presentUserIds.has(w.id))
      .map((w) => ({
        firstName: w.firstName,
        lastName: w.lastName,
        gender: w.gender,
        phoneNumber: w.phoneNumber,
        departments: w.departments,
      }));

    const docDefinition = buildSessionReportDocDefinition({
      churchName: settings?.name ?? "My Church",
      churchAddress: settings?.address ?? null,
      sessionName: session.serviceName,
      sessionDate: session.date,
      services,
      generatedByName: generatedBy
        ? `${generatedBy.firstName} ${generatedBy.lastName}`.trim()
        : "Unknown",
      generatedAt: new Date(),
      attendees: filteredAttendees,
      incomes,
      missedWorkers,
      deptLateOverrides: deptLateOverrides.map((o) => ({
        departmentId: o.departmentId,
        departmentName: o.department.name,
        lateTime: o.lateTime,
      })),
    });

    const firstServiceTime = services[0]?.serviceTime ?? session.startedAt;
    const dateLabel = (session.date ?? firstServiceTime).toISOString().slice(0, 10);
    const filename = `${sanitizeFilename(session.serviceName)}_${dateLabel}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = pdfmake.createPdf(docDefinition);
    const stream = await pdfDoc.getStream();
    stream.pipe(res);
    stream.end();
  }
}
