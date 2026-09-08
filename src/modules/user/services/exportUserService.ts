import prisma from "../../../core/databases/prisma";
import {
  Document,
  HeadingLevel,
  Paragraph,
  TextRun,
  Packer,
} from "docx";


export async function exportUsersByDepartment(): Promise<Buffer> {
  const users = await prisma.user.findMany({
    where: {
      accountStatus: "ACTIVE",
    },
    select: {
      firstName: true,
      lastName: true,
      workerType: true,

      departments: {
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      },

      headedDepartments: {
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      },

      assistantDepartments: {
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  });

  const departmentNames = new Map<string, string>();
  const membersByDepartment = new Map<string, Set<string>>();

  for (const user of users) {
    for (const department of [
      ...user.departments,
      ...user.headedDepartments,
      ...user.assistantDepartments,
    ]) {
      departmentNames.set(department.id, department.name);
    }

    const name = `${user.firstName} ${user.lastName}`.trim();
    if (!name) continue;

    let primaryDepartment;

    if (user.workerType === "EXECUTIVE") {
      primaryDepartment =
        user.headedDepartments[0] ??
        user.assistantDepartments[0] ??
        user.departments[0];
    } else {
      primaryDepartment = user.departments[0];
    }

    if (!primaryDepartment) continue;

    if (!membersByDepartment.has(primaryDepartment.id)) {
      membersByDepartment.set(primaryDepartment.id, new Set<string>());
    }

    membersByDepartment.get(primaryDepartment.id)!.add(name);
  }

  const groups = Array.from(membersByDepartment.entries())
    .map(([departmentId, names]) => ({
      departmentName:
        departmentNames.get(departmentId) ?? "Unknown Department",
      names: Array.from(names).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

  const children: Paragraph[] = [
    new Paragraph({
      text: "Members by Department",
      heading: HeadingLevel.TITLE,
    }),
  ];

  for (const group of groups) {
    children.push(
      new Paragraph({
        text: group.departmentName,
        heading: HeadingLevel.HEADING_1,
      }),
    );

    for (const name of group.names) {
      children.push(
        new Paragraph({
          children: [new TextRun(name)],
          bullet: {
            level: 0,
          },
        }),
      );
    }
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
