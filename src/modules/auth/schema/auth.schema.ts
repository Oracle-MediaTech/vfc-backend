import { z } from "zod";
import { Gender, ChurchStatus, MembershipType } from "@prisma/client";

// Register User Schema
export const RegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),

  gender: z.nativeEnum(Gender),
  address: z.string().min(1, "Address is required"),

  dateOfBirth: z.string().optional(),

  // Campus-specific details
  matricNumber: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
  faculty: z.string().optional(),

  // Church journey
  churchStatus: z.nativeEnum(ChurchStatus),

  membershipType: z.nativeEnum(MembershipType).optional(),

  // 👇 Department relations
  departmentIds: z.array(z.string()).optional(),     // members
  headDepartmentIds: z.array(z.string()).optional(), // departments user heads
  assistantDepartmentIds: z.array(z.string()).optional(), // departments user assists

  nationality: z.string().optional(),
  stateOfOrigin: z.string().optional(),
  emergencyContact: z.string().optional(),

  // Security
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

// Login User Schema
export const LoginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

// Change Password Schema
export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(6, "Old password must be at least 6 characters"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmNewPassword: z.string().min(6, "Confirm new password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New password and confirmation password must match",
});

// Reset Password Schema
export const ResetPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

// Verify Token Schema
export const VerifyTokenSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

// Setup-Password (invite acceptance) schema
export const AcceptInviteSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
});
