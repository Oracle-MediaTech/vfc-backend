import { Request, Response, NextFunction, Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';
import { Routes } from "../../../core/routes/interfaces";
import { authenticate, authorize } from '../../../core/middlewares/AuthMiddleware';
import { UserRole } from '@prisma/client';
import {
  CreateAttendanceSessionSchema,
  UpdateAttendanceSessionSchema,
  MarkAttendanceSchema,
  BulkMarkAttendanceSchema,
  SessionFilterQuerySchema,
  UpdateAttendanceSchema,
  UpsertSessionIncomeSchema,
} from '../schema/attendance.schema';
import { validate } from '../../../core/middlewares';

class AttendanceRoute implements Routes {
  public path = '/attendance';
  public router = Router();
  public attendanceController = new AttendanceController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // this.router.all(`${this.path}*`, (req: Request, res: Response, next: NextFunction) => {
    //   next();
    // });

            this.router.all(`${this.path}/*splat`, (req, res, next) => {
    next();
});
    // Start a new attendance session
    this.router.post(`${this.path}/session`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      validate(CreateAttendanceSessionSchema),
      this.attendanceController.startSession
    );

    // Mark a user's attendance
    this.router.post(`${this.path}/mark`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      validate(MarkAttendanceSchema),
      this.attendanceController.markAttendance
    );

    // Bulk mark attendance for multiple users
    this.router.post(`${this.path}/mark-bulk`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      validate(BulkMarkAttendanceSchema),
      this.attendanceController.bulkMarkAttendance
    );

    // Analytics endpoints (must be before /session/:id to avoid conflict)
    this.router.get(`${this.path}/analytics/summary`,
      authenticate,
      this.attendanceController.getAttendanceSummary
    );

    this.router.get(`${this.path}/analytics/top-members`,
      authenticate,
      this.attendanceController.getTopMembers
    );

    this.router.get(`${this.path}/analytics/member-history/:userId`,
      authenticate,
      this.attendanceController.getMemberAttendanceHistory
    );

    this.router.get(`${this.path}/me`,
      authenticate,
      this.attendanceController.getMyAttendances
    );

    this.router.get(`${this.path}/analytics/trend`,
      authenticate,
      this.attendanceController.getAttendanceTrend
    );

    this.router.get(`${this.path}/analytics/rate`,
      authenticate,
      this.attendanceController.getAttendanceRate
    );

    // Get all sessions (with pagination)
    this.router.get(`${this.path}/sessions`,
      authenticate,
      this.attendanceController.getAllSessions
    );

    // Get single session by ID (supports filter query params)
    this.router.get(`${this.path}/session/:id`,
      authenticate,
      validate(SessionFilterQuerySchema, "query"),
      this.attendanceController.getSessionById
    );

    // Export session attendance as PDF (same filters as the list endpoint)
    this.router.get(`${this.path}/session/:id/pdf`,
      authenticate,
      validate(SessionFilterQuerySchema, "query"),
      this.attendanceController.exportSessionPdf
      
    );

    // Update a session
    this.router.put(`${this.path}/session/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(UpdateAttendanceSessionSchema),
      this.attendanceController.updateSession
    );

    // Delete a session
    this.router.delete(`${this.path}/session/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.attendanceController.deleteSession
    );

    // Read income matrix for a session
    this.router.get(`${this.path}/session/:id/income`,
      authenticate,
      this.attendanceController.getSessionIncome
    );

    // Upsert income for a session (ADMIN + WORKER per product decision)
    this.router.put(`${this.path}/session/:id/income`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      validate(UpsertSessionIncomeSchema),
      this.attendanceController.upsertSessionIncome
    );

    // Close / reopen — soft close, just toggles endedAt
    this.router.post(`${this.path}/session/:id/close`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      this.attendanceController.closeSession
    );

    this.router.post(`${this.path}/session/:id/reopen`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      this.attendanceController.reopenSession
    );

    // Edit a single attendance entry (markedAt). Registered after /session/:id
    // routes so Express resolves the more specific path first.
    this.router.put(`${this.path}/:id`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      validate(UpdateAttendanceSchema),
      this.attendanceController.updateAttendance
    );

    // Delete a single attendance entry
    this.router.delete(`${this.path}/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.attendanceController.deleteAttendance
    );
this.router.get(
  `${this.path}/analytics/consecutive-absentees`,
  authenticate,
  authorize(UserRole.ADMIN),
  this.attendanceController.getConsecutiveAbsentees
);
this.router.get(
  `${this.path}/analytics/consecutive-late-comers`,
  authenticate,
  authorize(UserRole.ADMIN),
  this.attendanceController.getConsecutiveLateComers
);
  
  }
}

export { AttendanceRoute };
