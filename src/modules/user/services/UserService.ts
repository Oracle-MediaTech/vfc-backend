import {
   Prisma,
   AccountStatus,
   ChurchStatus,
   Gender,
   MembershipType,
   UserRole,
   WorkerType,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { IUser } from "../models/UserModel";
import prisma from "../../../core/databases/prisma";
import { paginate } from "../../../core/utils/paginate";
import XLSX from "xlsx";
import fs from "node:fs";
import { analyzeTransactions } from "../../../core/utils/transaction";
import { logDevError } from "../../../core/utils";

type User = Prisma.UserGetPayload<{}>;

export class UserService {
  async createUser(data: IUser): Promise<Partial<User>> {
    let hashedPassword: string | null = null;

    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const {
      attendances,
      departmentIds,
      headDepartmentIds,
      assistantDepartmentIds,
      ...rest
    } = data;

    let prismaData: any = {
      ...rest,
      password: hashedPassword,
    };

    if (rest.dateOfBirth) {
      prismaData.dateOfBirth = new Date(rest.dateOfBirth as any);
    }

    if (rest.matricNumber === "") {
      prismaData.matricNumber = null;
    }

    if (rest.phoneNumber === "") {
      rest.phoneNumber = '090xxxxxxxx'
    }

    if (rest.email === "") {
      rest.email = 'test@gmail.com'
    }

    if (attendances) {
      prismaData.attendances = {
        create: attendances.map((attendance) => ({
          ...attendance,
        })),
      };
    }

      const {
         attendances,
         departmentIds,
         headDepartmentIds,
         assistantDepartmentIds,
         ...rest
      } = data;

      let prismaData: any = {
         ...rest,
         password: hashedPassword,
      };

      if (rest.dateOfBirth) {
         prismaData.dateOfBirth = new Date(rest.dateOfBirth as any);
      }

    if (assistantDepartmentIds?.length) {
      prismaData.assistantDepartments = {
        connect: assistantDepartmentIds.map((id) => ({ id })),
      };
    }

    const result = await prisma.user.create({
      data: prismaData,
    });

    if (!result) {
      throw new Error("Failed to create user");
    }

    const { password, ...userWithoutPassword } = result;
    return userWithoutPassword;
  }


  async getUserById(id: string): Promise<Partial<User> | null> {
    const result = await prisma.user.findUnique({
      where: { id },
      include: {
        departments: {
          select: {
            id: true,
            name: true,
          },
        },
        headedDepartments: {
          select: {
            id: true,
            name: true,
          },
        },
        assistantDepartments: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!result) {
      throw new Error("User not found");
    }

    const { password, ...userWithoutPassword } = result;
    return userWithoutPassword;
  }

  async getUserByIdWithPassword(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async getUserByName(name: string): Promise<Partial<User>[] | null> {
    const results = await prisma.user.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: name,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: name,
              mode: "insensitive",
            },
          },
        ],
      },
    });

    if (!results) {
      throw new Error("User not found");
    }

    return results.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
  }

  async getUser(id: string): Promise<Partial<User> | null> {
    // Include both M2M relations on User → Department so the exco dashboard
    // (which scopes its UI to the caller's headed/assistant departments) and
    // any other "me" consumer can render dept context without a 2nd request.
    const result = await prisma.user.findUnique({
      where: { id },
      include: {
        departments: { select: { id: true, name: true } },
        headedDepartments: { select: { id: true, name: true } },
        assistantDepartments: { select: { id: true, name: true } },
        deptPositions: {
          select: {
            departmentId: true,
            position: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!result) {
      throw new Error("User not found");
    }

    // Resolve permissions per department in one pass so the frontend doesn't
    // have to make N requests. Imported here (not at top) to avoid a cycle
    // with core/permissions which doesn't import this module.
    const { permissionsByDepartmentForUser } = await import("../../../core/permissions");
    const permissionsByDepartment = await permissionsByDepartmentForUser(id);

    const { password, ...userWithoutPassword } = result;
    return { ...userWithoutPassword, permissionsByDepartment } as Partial<User>;
  }

  async analyzeExpenses(filePath: string): Promise<any> {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const transactions = XLSX.utils.sheet_to_json(sheet, {
      range: 7,
      defval: null
    });

    const totals = analyzeTransactions(transactions);

    fs.unlinkSync(filePath);

    return totals;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<Partial<User>[]> {
    const result = await prisma.user.findMany();

    if (!result) {
      throw new Error("Failed to get users");
    }

    return result.map(({ password, ...rest }) => rest);
  }

  /**
   * Get users with filters and pagination
   */
  async getFilteredUsers(params: {
    page?: number;
    limit?: number;
    churchStatus?: ChurchStatus;
    membershipType?: MembershipType;
    role?: UserRole;
    accountStatus?: AccountStatus;
    /** Filter to users who are members of this department. */
    departmentId?: string;
    search?: string;
  }) {
    const where: any = {};

    if (params.churchStatus) where.churchStatus = params.churchStatus;
    if (params.membershipType) where.membershipType = params.membershipType;
    if (params.role) where.role = params.role;
    if (params.accountStatus) where.accountStatus = params.accountStatus;
    if (params.departmentId) {
      where.departments = { some: { id: params.departmentId } };
    }
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ];
    }

    return paginate(prisma.user, {
      page: params.page || 1,
      limit: params.limit || 10,
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Flip a user's accountStatus. Used by the admin members page for
   * suspend/inactive/archive/restore actions.
   */
  async updateAccountStatus(id: string, accountStatus: AccountStatus) {
    const updated = await prisma.user.update({
      where: { id },
      data: { accountStatus },
      select: { id: true, accountStatus: true },
    });
    return updated;
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: Partial<IUser>): Promise<Partial<User>> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const {
      attendances,
      departmentIds,
      headDepartmentIds,
      assistantDepartmentIds,
      ...rest
    } = data;

    let prismaData: any = { ...rest };

    if (rest.dateOfBirth) {
      prismaData.dateOfBirth = new Date(rest.dateOfBirth as any);
    }

    if (rest.matricNumber === "") {
      prismaData.matricNumber = null;
    }

    if (attendances) {
      prismaData.attendances = {
        set: attendances.map((attendance) => ({ id: attendance.id })),
      };

      for (const row of rows) {
         try {
            const email = row.email?.toString().trim().toLowerCase();
            if (!email) {
               results.errors.push(`Row skipped: missing email`);
               continue;
            }

            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
               results.skipped.push(email);
               continue;
            }

            if (
               !row.firstName ||
               !row.lastName ||
               !row.phoneNumber ||
               !row.gender ||
               !row.address
            ) {
               results.errors.push(
                  `"${email}": missing required fields (firstName, lastName, phoneNumber, gender, address)`,
               );
               continue;
            }

            const gender = row.gender?.toString().toUpperCase();
            if (gender !== "MALE" && gender !== "FEMALE") {
               results.errors.push(
                  `"${email}": invalid gender "${row.gender}". Must be MALE or FEMALE`,
               );
               continue;
            }

            let churchStatus: ChurchStatus = ChurchStatus.VISITOR;
            if (row.churchStatus) {
               const status = row.churchStatus
                  .toString()
                  .toUpperCase()
                  .replace(/\s+/g, "_");
               if (
                  Object.values(ChurchStatus).includes(status as ChurchStatus)
               ) {
                  churchStatus = status as ChurchStatus;
               }
            }

            await prisma.user.create({
               data: {
                  firstName: row.firstName.toString().trim(),
                  lastName: row.lastName.toString().trim(),
                  email,
                  phoneNumber: row.phoneNumber.toString().trim(),
                  gender: gender as Gender,
                  address: row.address.toString().trim(),
                  churchStatus,
                  dateOfBirth: row.dateOfBirth
                     ? new Date(row.dateOfBirth)
                     : null,
                  matricNumber: row.matricNumber?.toString().trim() || null,
                  department: row.department?.toString().trim() || null,
                  level: row.level?.toString().trim() || null,
                  faculty: row.faculty?.toString().trim() || null,
                  nationality: row.nationality?.toString().trim() || null,
                  stateOfOrigin: row.stateOfOrigin?.toString().trim() || null,
                  emergencyContact:
                     row.emergencyContact?.toString().trim() || null,
               },
            });

            results.created++;
         } catch (error: any) {
            logDevError(error);
            results.errors.push(`"${row.email}": ${error.message}`);
         }
      }

      return results;
   }

   /**
    * Delete user
    */
   async deleteUser(id: string): Promise<Partial<User>> {
      const result = await prisma.user.delete({
         where: { id },
      });

      if (!result) {
         throw new Error("Failed to delete user");
      }

      const { password, ...userWithoutPassword } = result;
      return userWithoutPassword;
   }
}
