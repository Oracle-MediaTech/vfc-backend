import * as XLSX from "xlsx";
import prisma from "../../core/databases/prisma";
// import { CustomError } from "../../core/utils";
import {
  ExportField,
  ExportRequest,
  ExportRow,
} from "./export.types";

type ExportQuery = () => Promise<ExportRow[]>;

const exportQueries: Record<string, ExportQuery> = {
  users: async () => {
    const users = await prisma.user.findMany({
      where: {
        churchStatus: "MEMBER",
      },
      include: {
        primaryDepartment: true,
      },
    });

    return users.map((user) => ({
      ...user,
      primaryDepartment: user.primaryDepartment?.name ?? "",
    }));
  },

  departments: async () => {
    const departments = await prisma.department.findMany();

    return departments.map((department) => ({
      ...department,
    }));
  },

  attendance: async () => {
    const attendance = await prisma.attendance.findMany();

    return attendance.map((record) => ({
      ...record,
    }));
  },

  invoices: async () => {
    const invoices = await prisma.invoice.findMany();

    return invoices.map((invoice) => ({
      ...invoice,
    }));
  },
};

const getNestedValue = (
  object: Record<string, unknown>,
  path: string,
): unknown => {
  return path.split(".").reduce<unknown>((current, key) => {
    if (
      current !== null &&
      typeof current === "object" &&
      key in current
    ) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, object);
};

const formatCellValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatCellValue(item))
      .join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

export class ExportService {
  public async export({
    tableName,
    fields,
  }: ExportRequest): Promise<Buffer> {
    if (!tableName) {
      // throw new CustomError("Table name is required", 400);
      throw new Error("Table name is required");
    }

    if (!fields || fields.length === 0) {
      throw new Error("At least one field is required");
      // throw new CustomError(
      //   "At least one field is required",
      //   400,
      // );
    }

    const query = exportQueries[tableName];

    if (!query) {
      throw new Error(`Export for "${tableName}" is not supported`);
      // throw new CustomError(
      //   `Export for "${tableName}" is not supported`,
      //   400,
      // );
    }

    const rows = await query();

    const worksheetData = rows.map((row) => {
      const formattedRow: Record<string, string | number | boolean> = {};

      for (const field of fields) {
        const value = getNestedValue(row, field.key);

        formattedRow[field.label] = formatCellValue(value);
      }

      return formattedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    worksheet["!cols"] = fields.map((field) => {
      const maxLength = Math.max(
        field.label.length,
        ...worksheetData.map((row) =>
          String(row[field.label] ?? "").length,
        ),
      );

      return {
        wch: Math.min(Math.max(maxLength + 2, 12), 50),
      };
    });

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      tableName.substring(0, 31),
    );

    return XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });
  }
}