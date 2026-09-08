import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;
const schemaMatch = connectionString.match(/[?&]schema=([^&]+)/);
const schema = schemaMatch ? schemaMatch[1] : "public";

const pool = new Pool({
  connectionString,
  options: `-c search_path=${schema}`,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const departments = [
    {
      name: "Brothers Department",
      description: "Involves all brothers in the church",
    },
    {
      name: "Sisters Department",
      description: "Involves all sisters in the church",
    },
    {
      name: "Prayer Department",
      description: "Handles prayer activities and intercession",
    },
    {
      name: "Organizing Department",
      description: "Manages organizational activities and planning",
    },
    {
      name: "Media Department",
      description: "Manages media, communications, and content creation",
    },
    {
      name: "Music Department",
      description: "Coordinates music and choir activities",
    },
    {
      name: "Sound and Technical Department",
      description: "Manages sound systems and technical operations",
    },
    {
      name: "Drama Department",
      description: "Coordinates drama and theatrical presentations",
    },
    {
      name: "Sanctuary Department",
      description: "Maintains cleanliness and orderliness of the sanctuary",
    },
    {
      name: "Ushering Department",
      description: "Manages ushering and congregation coordination",
    },
    {
      name: "Evangelism and Outreach Department",
      description: "Coordinates evangelism and community outreach",
    },
    {
      name: "Hospitality Department",
      description: "Handles hospitality and guest reception",
    },
    {
      name: "Welfare Department",
      description: "Manages welfare and member support programs",
    },
  ];

  const seededDepartments = new Map<string, { id: string; name: string }>();

  for (const dept of departments) {
    const created = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    seededDepartments.set(created.name, created);
  }

  console.log(`Seeded ${departments.length} departments`);

  const brothersDepartmentId = seededDepartments.get(
    "Brothers Department",
  )?.id;
  const sistersDepartmentId = seededDepartments.get("Sisters Department")?.id;

  if (brothersDepartmentId && sistersDepartmentId) {
    const users = await prisma.user.findMany({
      where: { gender: { in: ["MALE", "FEMALE"] }, churchStatus: "MEMBER", },
      select: { id: true, gender: true },
    });

    await Promise.all(
      users.map(async (user) => {
        const targetDepartmentId =
          user.gender === "MALE"
            ? brothersDepartmentId
            : sistersDepartmentId;

        return await prisma.user.update({
          where: { id: user.id },
          data: {
            departments: {
              connect: { id: targetDepartmentId },
            },
          },
        });
      }),
    );

    console.log(`Assigned ${users.length} users to gender departments`);
  }

  // ── Permissions ────────────────────────────────────────────────────────
  // Keys are the canonical source of truth; src/core/permissions.ts mirrors
  // them as `PERM.<key>` constants. Upsert so re-running the seed is safe.
  const permissions: Array<{
    key: string;
    label: string;
    description: string;
  }> = [
      {
        key: "canManageMembers",
        label: "Manage members",
        description: "Add, remove, and update members in a department.",
      },
      {
        key: "canManageAttendance",
        label: "Manage attendance",
        description: "Mark and edit attendance records for the department.",
      },
      {
        key: "canViewAnalytics",
        label: "View analytics",
        description: "View department analytics and trend charts.",
      },
      {
        key: "canManageTasks",
        label: "Manage tasks",
        description: "Create, assign, and update tasks for the department.",
      },
      {
        key: "canManageResources",
        label: "Manage resources",
        description: "Upload and manage department resources.",
      },
      {
        key: "canMakeAnnouncements",
        label: "Make announcements",
        description: "Post announcements to the department.",
      },
      {
        key: "canApproveRequests",
        label: "Approve requests",
        description:
          "Review and approve member requests (leave, excuse, etc.).",
      },
      {
        key: "canManageDeptSettings",
        label: "Manage department settings",
        description: "Edit department-level configuration.",
      },
    ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, description: p.description },
      create: p,
    });
  }
  console.log(`Seeded ${permissions.length} permissions`);

  // ── Positions + default permission bindings ────────────────────────────
  // HOD = everything. Assistant HOD = all but settings. Others get focused
  // subsets that match their typical job. Admins can later edit these via
  // GET/POST endpoints on /positions.
  const allKeys = permissions.map((p) => p.key);
  const allButSettings = allKeys.filter((k) => k !== "canManageDeptSettings");

  const positions: Array<{
    name: string;
    description: string;
    permKeys: string[];
  }> = [
      { name: "HOD", description: "Head of Department.", permKeys: allKeys },
      {
        name: "Assistant HOD",
        description: "Deputy to the HOD.",
        permKeys: allButSettings,
      },
      {
        name: "Secretary",
        description: "Keeps records and communications.",
        permKeys: ["canManageMembers", "canMakeAnnouncements"],
      },
      {
        name: "Coordinator",
        description: "Coordinates day-to-day work.",
        permKeys: [
          "canManageMembers",
          "canManageAttendance",
          "canManageTasks",
        ],
      },
      {
        name: "Team Lead",
        description: "Leads a sub-team within the department.",
        permKeys: ["canManageAttendance", "canManageTasks"],
      },
      {
        name: "Department Executive",
        description: "General executive seat.",
        permKeys: allButSettings,
      },
    ];

  for (const pos of positions) {
    const created = await prisma.position.upsert({
      where: { name: pos.name },
      update: { description: pos.description },
      create: { name: pos.name, description: pos.description },
    });

    // Reset bindings to match seed (idempotent re-run).
    await prisma.positionPermission.deleteMany({
      where: { positionId: created.id },
    });
    for (const key of pos.permKeys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue;
      await prisma.positionPermission.create({
        data: { positionId: created.id, permissionId: perm.id },
      });
    }
  }
  console.log(`Seeded ${positions.length} positions with permission bindings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
