import {
   ChurchStatus,
   Gender,
   MembershipType,
   UserRole,
   WorkerType,
} from "@prisma/client";
import { IAttendance } from "../../attendance/interfaces/AttendanceModel";

export interface IUser {
   id?: string;
   firstName: string;
   lastName: string;
   email: string;
   phoneNumber: string;
   gender: Gender;
   address: string;
   dateOfBirth?: Date;
   password?: string;

   // Campus-specific details
   matricNumber?: string; // For students only
   department?: string;
   level?: string; // e.g., "100", "200", "300", "400", "Postgraduate"
   faculty?: string;

   // Layered church journey
   churchStatus: ChurchStatus;
   membershipType?: MembershipType;
   workerType?: WorkerType;

   // System access role
   role?: UserRole;

   // Other identifiers
   nationality?: string;
   stateOfOrigin?: string;
   emergencyContact?: string;

   // Department relations (sent as ID arrays; translated to Prisma connect/set in UserService)
   departmentIds?: string[];
   primaryDepatmentId?: string;
   headDepartmentIds?: string[];
   assistantDepartmentIds?: string[];

   // Attendance relation
   attendances?: IAttendance[];

   createdAt?: Date;
   updatedAt?: Date;
}
