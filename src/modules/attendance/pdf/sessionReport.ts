import {
  ChurchStatus,
  Gender,
  IncomeCategory,
  MembershipType,
  PaymentMethod,
} from "@prisma/client";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  isLateAttendance,
  AttendeeWithUser,
  SessionServiceLite,
} from "../utils/attendanceFilters";

export interface IncomeEntry {
  serviceOrder: number;
  category: IncomeCategory;
  method: PaymentMethod;
  amount: number;
}

export interface MissedWorker {
  firstName: string;
  lastName: string;
  gender: Gender;
  phoneNumber: string;
  departments?: Array<{ id: string; name: string }>;
}

export interface DeptLateOverride {
  departmentId: string;
  departmentName: string;
  /** "HH:mm" 24-hour. Applied to each service's calendar date. */
  lateTime: string;
}

export interface SessionReportInput {
  churchName: string;
  churchAddress?: string | null;
  sessionName: string;
  sessionDate: Date | null;
  services: SessionServiceLite[]; // sorted by order ASC
  generatedByName: string;
  generatedAt: Date;
  attendees: AttendeeWithUser[];
  /** Optional — when present, the report includes an Income Summary section. */
  incomes?: IncomeEntry[];
  /** Workers (membershipType=WORKER) who weren't marked in this session. */
  missedWorkers?: MissedWorker[];
  /**
   * Per-department late-time overrides for the session's ServiceDay. Renders
   * a "Per-department Late Workers" section keyed by these — independent of
   * the session-wide late check, which still uses the worker's pre-service
   * cutoff. Empty/omitted ⇒ no per-dept section.
   */
  deptLateOverrides?: DeptLateOverride[];
}

interface DepartmentStat {
  total: number;
  male: number;
  female: number;
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const formatDateTime = (d: Date) => `${formatDate(d)} ${formatTime(d)}`;

const fullName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName} ${u.lastName}`.trim();

const departmentNames = (user: AttendeeWithUser["user"]) =>
  user.departments?.map((d) => d.name).join(", ") || "—";

const minutesLate = (markedAt: Date, cutoff: Date) =>
  Math.max(0, Math.round((markedAt.getTime() - cutoff.getTime()) / 60000));

const cutoffFor = (
  membershipType: MembershipType | null,
  service: SessionServiceLite,
) =>
  membershipType === MembershipType.WORKER && service.preServiceTime
    ? service.preServiceTime
    : service.serviceTime;

const serviceLabel = (order: number) => `S${order}`;

/**
 * Build the pdfmake `TDocumentDefinitions` for a session attendance report.
 * Pure function — no I/O, no Prisma calls — so it can be snapshot-tested.
 */
export function buildSessionReportDocDefinition(input: SessionReportInput): TDocumentDefinitions {
  const {
    churchName,
    churchAddress,
    sessionName,
    sessionDate,
    services,
    generatedByName,
    generatedAt,
    attendees,

  } = input;

  const sortedServices = [...services].sort((a, b) => a.order - b.order);
  const serviceByOrder = new Map<number, SessionServiceLite>(
    sortedServices.map((s) => [s.order, s]),
  );
  const fallbackService = sortedServices[0];

  const serviceFor = (attendee: AttendeeWithUser): SessionServiceLite =>
    serviceByOrder.get(attendee.serviceOrder) ?? fallbackService;

  const isLate = (attendee: AttendeeWithUser) =>
    isLateAttendance(
      attendee.markedAt,
      attendee.user.membershipType,
      serviceFor(attendee),
    );

  const isMulti = sortedServices.length > 1;

  // Analytics
  const total = attendees.length;
  const male = attendees.filter((a) => a.user.gender === Gender.MALE).length;
  const female = attendees.filter((a) => a.user.gender === Gender.FEMALE).length;
  const workers = attendees.filter((a) => a.user.membershipType === MembershipType.WORKER);
  const nonWorkers = attendees.filter(
    (a) => a.user.membershipType === MembershipType.NON_WORKER,
  );
  const firstTimers = attendees.filter((a) => a.user.churchStatus === ChurchStatus.FIRST_TIMER);
  const visitors = attendees.filter((a) => a.user.churchStatus === ChurchStatus.VISITOR);
  const level100Students = attendees.filter((a) => a.user.level === "100");
  const lateAttendees = attendees.filter(isLate);
  const lateWorkers = lateAttendees.filter(
    (a) => a.user.membershipType === MembershipType.WORKER,
  );

  // Department breakdown
  const deptStats = new Map<string, DepartmentStat>();
  for (const a of attendees) {
    for (const dept of a.user.departments ?? []) {
      const stat = deptStats.get(dept.name) ?? { total: 0, male: 0, female: 0 };
      stat.total += 1;
      if (a.user.gender === Gender.MALE) stat.male += 1;
      if (a.user.gender === Gender.FEMALE) stat.female += 1;
      deptStats.set(dept.name, stat);
    }
  }
  const deptRows = Array.from(deptStats.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, s]) => [name, String(s.male), String(s.female), String(s.total)]);

  // Summary rows
  const summaryRows: [string, string][] = [
    ["Total Attendance", String(total)],
    ["Male", String(male)],
    ["Female", String(female)],
    ["Workers", String(workers.length)],
    ["Non-workers", String(nonWorkers.length)],
    ["First Timers", String(firstTimers.length)],
    ["Visitors", String(visitors.length)],
    ["100 Level Students", String(level100Students.length)],
    ["Late Comers", String(lateAttendees.length)],
    ["Late Worker Comers", String(lateWorkers.length)],
  ];

  // Per-service summary
  const perServiceRows = sortedServices.map((s) => {
    const inService = attendees.filter((a) => a.serviceOrder === s.order);
    const lateInService = inService.filter(isLate).length;
    return [
      serviceLabel(s.order),
      formatTime(s.serviceTime),
      s.preServiceTime ? formatTime(s.preServiceTime) : "—",
      s.closesAt ? formatTime(s.closesAt) : "—",
      String(inService.length),
      String(lateInService),
    ];
  });

  const workerRows = workers
    .slice()
    .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
    .map((a, index) => {
      const base = [
        String(index + 1),
        fullName(a.user),
        a.user.gender,
        departmentNames(a.user),
        formatTime(a.markedAt),
        isLate(a) ? "Yes" : "No",
      ];

      return isMulti
        ? [...base, serviceLabel(a.serviceOrder)]
        : base;
    });

  const lateWorkerRows = lateWorkers
    .slice()
    .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
    .map((a, index) => {
      const cutoff = cutoffFor(a.user.membershipType, serviceFor(a));

      const base = [
        String(index + 1),
        fullName(a.user),
        a.user.gender,
        departmentNames(a.user),
        formatTime(a.markedAt),
        `${minutesLate(a.markedAt, cutoff)} min`,
      ];

      return isMulti
        ? [...base, serviceLabel(a.serviceOrder)]
        : base;
    });

  // Non-worker rows
  const nonWorkerRows = nonWorkers
    .slice()
    .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
    .map((a, index) => {
      const base = [
        String(index + 1),
        fullName(a.user),
        a.user.gender,
        a.user.department || "—",
        formatTime(a.markedAt),
        isLate(a) ? "Yes" : "No",
      ];
      return isMulti ? [...base, serviceLabel(a.serviceOrder)] : base;
    });

  // First timer rows
  const firstTimerRows = firstTimers
    .slice()
    .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
    .map((a, index) => {
      const base = [String(index + 1), fullName(a.user), a.user.gender, a.user.phoneNumber || "—"];
      return isMulti ? [...base, serviceLabel(a.serviceOrder)] : base;
    });


  // Visitor rows
  const visitorRows = visitors
    .slice()
    .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
    .map((a, index) => {
      const base = [String(index + 1), fullName(a.user), a.user.gender, a.user.phoneNumber || "—"];
      return isMulti ? [...base, serviceLabel(a.serviceOrder)] : base;
    });

  // 100 level student rows
  const level100Rows = level100Students
    .slice()
    .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
    .map((a, index) => {
      const isWorker = a.user.membershipType === MembershipType.WORKER;
      const base = [
        String(index + 1),
        fullName(a.user),
        a.user.gender,
        isWorker ? "Yes" : "No",
        a.user.department || "—",
        isWorker ? departmentNames(a.user) : "—",
        a.user.churchStatus === ChurchStatus.FIRST_TIMER ? "Yes" : "No",
      ];
      return isMulti ? [...base, serviceLabel(a.serviceOrder)] : base;
    });

  const headerRow = (cells: string[]) =>
    cells.map((c) => ({ text: c, bold: true, fillColor: "#f3f4f6" }));

  const sessionTimesLine = isMulti
    ? [
      { text: `Services: ${sortedServices.length}`, margin: [0, 2, 0, 0] as [number, number, number, number] },
    ]
    : sortedServices.length === 1
      ? [
        { text: `Service Time: ${formatTime(sortedServices[0].serviceTime)}`, margin: [0, 2, 0, 0] as [number, number, number, number] },
        sortedServices[0].preServiceTime
          ? { text: `Pre-service Time: ${formatTime(sortedServices[0].preServiceTime)}`, margin: [0, 2, 0, 0] as [number, number, number, number] }
          : "",
      ]
      : [];

  const incomeRows = (input.incomes ?? []).filter((e) => e.amount > 0);
  const hasIncome = incomeRows.length > 0;

  const CATEGORY_LABEL: Record<IncomeCategory, string> = {
    TITHE: "Tithe",
    OFFERING: "Offering",
    SPECIAL_DONATION: "Special Donation",
  };
  const CATEGORY_ORDER: IncomeCategory[] = ["TITHE", "OFFERING", "SPECIAL_DONATION"];

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const sumBy = (rows: IncomeEntry[], cat?: IncomeCategory, method?: PaymentMethod) =>
    rows
      .filter((r) => (cat ? r.category === cat : true) && (method ? r.method === method : true))
      .reduce((acc, r) => acc + r.amount, 0);

  const buildPerServiceIncomeTable = (svcOrder: number) => {
    const rows = incomeRows.filter((r) => r.serviceOrder === svcOrder);
    const body: Array<Array<{ text: string; bold?: boolean; fillColor?: string }>> = [
      headerRow(["Category", "Cash", "Transfer", "Total"]),
    ];
    for (const cat of CATEGORY_ORDER) {
      const cash = sumBy(rows, cat, "CASH");
      const transfer = sumBy(rows, cat, "TRANSFER");
      if (cash === 0 && transfer === 0) continue;
      body.push([
        { text: CATEGORY_LABEL[cat] },
        { text: fmtMoney(cash) },
        { text: fmtMoney(transfer) },
        { text: fmtMoney(cash + transfer), bold: true },
      ]);
    }
    // Footer row: totals across categories
    body.push([
      { text: "Total", bold: true, fillColor: "#f9fafb" },
      { text: fmtMoney(sumBy(rows, undefined, "CASH")), bold: true, fillColor: "#f9fafb" },
      { text: fmtMoney(sumBy(rows, undefined, "TRANSFER")), bold: true, fillColor: "#f9fafb" },
      { text: fmtMoney(sumBy(rows)), bold: true, fillColor: "#f9fafb" },
    ]);
    return body;
  };

  const buildGrandTotalsTable = () => {
    const body: Array<Array<{ text: string; bold?: boolean; fillColor?: string }>> = [
      headerRow(["Service", "Cash", "Transfer", "Total"]),
    ];
    for (const s of sortedServices) {
      const rows = incomeRows.filter((r) => r.serviceOrder === s.order);
      if (rows.length === 0) continue;
      body.push([
        { text: `Service ${s.order}` },
        { text: fmtMoney(sumBy(rows, undefined, "CASH")) },
        { text: fmtMoney(sumBy(rows, undefined, "TRANSFER")) },
        { text: fmtMoney(sumBy(rows)), bold: true },
      ]);
    }
    body.push([
      { text: "All services", bold: true, fillColor: "#f9fafb" },
      { text: fmtMoney(sumBy(incomeRows, undefined, "CASH")), bold: true, fillColor: "#f9fafb" },
      { text: fmtMoney(sumBy(incomeRows, undefined, "TRANSFER")), bold: true, fillColor: "#f9fafb" },
      { text: fmtMoney(sumBy(incomeRows)), bold: true, fillColor: "#f9fafb" },
    ]);
    return body;
  };

  // Missed workers — all church workers minus those marked in this session.
  const missedWorkerRows = (input.missedWorkers ?? []).map((w, index) => [
    String(index + 1),
    `${w.firstName} ${w.lastName}`.trim(),
    w.gender,
    (w.departments ?? []).map((d) => d.name).join(", ") || "—",
    w.phoneNumber || "—",
  ]);

  // ── Per-department late workers ────────────────────────────────────────

  const overrides = input.deptLateOverrides ?? [];

  const cutoffForOverride = (lateHHMM: string, base: Date): Date => {
    const [h, m] = lateHHMM.split(":").map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const deptLateBlocks: Content[] = [];
  if (overrides.length > 0) {
    deptLateBlocks.push({
      text: "Per-department Late Workers",
      style: "sectionHeading",
      margin: [0, 18, 0, 6] as [number, number, number, number],
    });
    deptLateBlocks.push({
      text: "Workers flagged using each department's own late cutoff (overrides the session-wide rule).",
      italics: true,
      color: "#6b7280",
      margin: [0, 0, 0, 6] as [number, number, number, number],
    });

    // Stable order: by department name.
    const sortedOverrides = [...overrides].sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );

    for (const ov of sortedOverrides) {
      const lateForOv = workers.filter((a) => {
        const inDept = (a.user.departments ?? []).some((d) => d.id === ov.departmentId);
        if (!inDept) return false;
        const cutoff = cutoffForOverride(ov.lateTime, serviceFor(a).serviceTime);
        return a.markedAt.getTime() > cutoff.getTime();
      });

      const rows = lateForOv
        .slice()
        .sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)))
        .map((a) => {
          const cutoff = cutoffForOverride(ov.lateTime, serviceFor(a).serviceTime);
          const base = [
            fullName(a.user),
            formatTime(a.markedAt),
            String(minutesLate(a.markedAt, cutoff)),
          ];
          return isMulti ? [...base, serviceLabel(a.serviceOrder)] : base;
        });

      deptLateBlocks.push(
        {
          text: `${ov.departmentName} — cutoff ${ov.lateTime}`,
          style: "subHeading",
          margin: [0, 8, 0, 4] as [number, number, number, number],
        },
        rows.length === 0
          ? { text: "No late workers for this department.", italics: true, color: "#6b7280" }
          : {
            table: {
              widths: isMulti ? ["*", "auto", "auto", "auto"] : ["*", "auto", "auto"],
              body: [
                headerRow(
                  isMulti
                    ? ["Name", "Arrival Time", "Minutes Late", "Service"]
                    : ["Name", "Arrival Time", "Minutes Late"],
                ),
                ...rows,
              ],
            },
            layout: "lightHorizontalLines",
          },
      );
    }
  }

  const incomeBlocks: Content[] = [];
  if (hasIncome) {
    incomeBlocks.push({
      text: "Income Summary",
      style: "sectionHeading",
      margin: [0, 18, 0, 6] as [number, number, number, number],
    });
    for (const s of sortedServices) {
      const perServiceRows = incomeRows.filter((r) => r.serviceOrder === s.order);
      if (perServiceRows.length === 0) continue;
      incomeBlocks.push(
        {
          text: isMulti ? `Service ${s.order}` : "Breakdown",
          style: "subHeading",
          margin: [0, 6, 0, 4] as [number, number, number, number],
        },
        {
          table: {
            widths: ["*", "auto", "auto", "auto"],
            body: buildPerServiceIncomeTable(s.order),
          },
          layout: "lightHorizontalLines",
        },
      );
    }
    if (isMulti) {
      incomeBlocks.push(
        {
          text: "Grand Totals",
          style: "subHeading",
          margin: [0, 10, 0, 4] as [number, number, number, number],
        },
        {
          table: {
            widths: ["*", "auto", "auto", "auto"],
            body: buildGrandTotalsTable(),
          },
          layout: "lightHorizontalLines",
        },
      );
    }
  }


  return {
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { fontSize: 9, color: "#111827" },
    info: { title: `${sessionName} Attendance Report` },
    content: [
      // Header
      { text: churchName, style: "churchName" },
      churchAddress ? { text: churchAddress, style: "churchAddress" } : "",
      { text: "Attendance Report", style: "reportTitle", margin: [0, 8, 0, 0] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: sessionName, style: "sessionName" },
              sessionDate
                ? { text: `Date: ${formatDate(sessionDate)}`, margin: [0, 2, 0, 0] }
                : "",
              ...sessionTimesLine,
            ],
          },
          {
            width: "auto",
            alignment: "right",
            stack: [
              { text: `Generated by: ${generatedByName}` },
              { text: `Generated at: ${formatDateTime(generatedAt)}`, margin: [0, 2, 0, 0] },
            ],
          },
        ],
        margin: [0, 8, 0, 0],
      },

      // Summary
      { text: "Attendance Summary", style: "sectionHeading", margin: [0, 18, 0, 6] },
      {
        table: {
          widths: ["*", "auto"],
          body: [headerRow(["Metric", "Count"]), ...summaryRows],
        },
        layout: "lightHorizontalLines",
      },

      // Per-service summary (only for multi-service)
      ...(isMulti
        ? [
          { text: "Per-service Summary", style: "sectionHeading", margin: [0, 18, 0, 6] as [number, number, number, number] },
          {
            table: {
              widths: ["auto", "auto", "auto", "auto", "auto", "auto"],
              body: [
                headerRow([
                  "Service",
                  "Service Time",
                  "Pre-service",
                  "Closes At",
                  "Attendees",
                  "Late",
                ]),
                ...perServiceRows,
              ],
            },
            layout: "lightHorizontalLines",
          },
        ]
        : []),

      // Income summary (only when recorded — skipped silently otherwise)
      ...incomeBlocks,

      // Department breakdown
      { text: "Department Breakdown", style: "sectionHeading", margin: [0, 18, 0, 6] },
      deptRows.length === 0
        ? { text: "No department attendance recorded.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: ["*", "auto", "auto", "auto"],
            body: [
              headerRow(["Department", "Male", "Female", "Total"]),
              ...deptRows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // Workers
      { text: "Workers", style: "sectionHeading", margin: [0, 18, 0, 6] },
      workerRows.length === 0
        ? { text: "No workers in this filtered view.", italics: true, color: "#6b7280" }
        : {
          table: {

            widths: isMulti
              ? ["auto", "*", "auto", "*", "auto", "auto", "auto"]
              : ["auto", "*", "auto", "*", "auto", "auto"],
            body: [
              headerRow(
                isMulti
                  ? ["#", "Name", "Sex", "Department(s)", "Time", "Late?", "Service"]
                  : ["#", "Name", "Sex", "Department(s)", "Time", "Late?"]
              ),
              ...workerRows,
            ],
          },
          layout: "lightHorizontalLines",
        },


      // Late workers
      { text: "Late workers Report", style: "sectionHeading", margin: [0, 18, 0, 6] },
      lateWorkers.length === 0
        ? { text: "No workers in this filtered view.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: isMulti
              ? ["auto", "*", "auto", "*", "auto", "auto", "auto"]
              : ["auto", "*", "auto", "*", "auto", "auto"],
            body: [
              headerRow(
                isMulti
                  ? ["#", "Name", "Sex", "Department(s)", "Arrival Time", "Late?", "Service"]
                  : ["#", "Name", "Sex", "Department(s)", "Arrival Time", "Late?"]
              ),
              ...lateWorkerRows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // Non-workers
      { text: "Non-workers", style: "sectionHeading", margin: [0, 18, 0, 6] },
      nonWorkerRows.length === 0
        ? { text: "No non-workers in this filtered view.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: isMulti
              ? ["auto", "*", "auto", "*", "auto", "auto", "auto"]
              : ["auto", "*", "auto", "*", "auto", "auto"],
            body: [
              headerRow(
                isMulti
                  ? ["#", "Name", "Sex", "Department(s)", "Time", "Late?", "Service"]
                  : ["#", "Name", "Sex", "Department(s)", "Time", "Late?"]
              ),
              ...nonWorkerRows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // First timers
      { text: "First Timers", style: "sectionHeading", margin: [0, 18, 0, 6] },
      firstTimerRows.length === 0
        ? { text: "No first timers recorded.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: isMulti ? ["auto", "*", "auto", "auto", "auto"] : ["auto", "*", "auto", "auto"],
            body: [
              headerRow(isMulti ? ["#", "Name", "Sex", "Phone", "Service"] : ["#", "Name", "Sex", "Phone",]),
              ...firstTimerRows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // Visitors
      { text: "Visitors", style: "sectionHeading", margin: [0, 18, 0, 6] },
      visitorRows.length === 0
        ? { text: "No visitors recorded.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: isMulti ? ["auto", "*", "auto", "auto", "auto"] : ["auto", "*", "auto", "auto"],
            body: [
              headerRow(isMulti ? ["#", "Name", "Sex", "Phone", "Service"] : ["#", "Name", "Sex", "Phone"]),
              ...visitorRows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // 100 Level Students
      { text: "100 Level Students", style: "sectionHeading", margin: [0, 18, 0, 6] },
      level100Rows.length === 0
        ? { text: "No 100 level students recorded.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: isMulti
              ? ["auto", "*", "auto", "auto", "*", "*", "auto", "auto"]
              : ["auto", "*", "auto", "auto", "*", "*", "auto"],
            body: [
              headerRow(
                isMulti
                  ? ["#", "Name", "Sex", "Worker?", "Department", "Departments", "First Timer?", "Service"]
                  : ["#", "Name", "Sex", "Worker?", "Department", "Departments", "First Timer?"],
              ),
              ...level100Rows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // Missed Workers — workers who weren't marked at this session.
      {
        text: `Missed Workers (${(input.missedWorkers ?? []).length})`,
        style: "sectionHeading",
        margin: [0, 18, 0, 6],
      },
      missedWorkerRows.length === 0
        ? { text: "All workers present.", italics: true, color: "#6b7280" }
        : {
          table: {
            widths: ["auto", "*", "auto", "auto", "auto"],
            body: [
              headerRow(["#", "Name", "Sex", "Department(s)", "Phone"]),
              ...missedWorkerRows,
            ],
          },
          layout: "lightHorizontalLines",
        },

      // Per-department late workers (rendered only when overrides exist)
      ...deptLateBlocks,
    ],
    styles: {
      churchName: { fontSize: 18, bold: true },
      churchAddress: { fontSize: 9, color: "#6b7280", margin: [0, 2, 0, 0] },
      reportTitle: { fontSize: 13, bold: true, color: "#374151" },
      sessionName: { fontSize: 12, bold: true },
      sectionHeading: { fontSize: 12, bold: true, color: "#1f2937" },
      subHeading: { fontSize: 10, bold: true, color: "#374151" },
    },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#9ca3af",
      margin: [0, 20, 0, 0],
    }),
  };
}