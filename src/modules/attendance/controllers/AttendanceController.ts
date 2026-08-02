import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "../services/AttendanceService";
import { AttendancePdfService } from "../services/AttendancePdfService";
import { SessionIncomeService } from "../services/SessionIncomeService";
import { StatusCodes } from "http-status-codes";
import { successResponse } from "../../../core/utils/responses.utils";
import { logDevError } from "../../../core/utils";
import { parseAttendanceFilterQuery } from "../utils/attendanceFilters";

export class AttendanceController {
  private attendanceService = new AttendanceService();
  private attendancePdfService = new AttendancePdfService();
  private sessionIncomeService = new SessionIncomeService();

  /**
   * Start a new attendance session (e.g., "Sunday Service")
   */
  public startSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceName, startedAt, date, serviceDayId, specialProgramId, services } = req.body;
      const result = await this.attendanceService.startSession({
        serviceName,
        startedAt: new Date(startedAt),
        date: date ? new Date(date) : undefined,
        serviceDayId: serviceDayId ?? null,
        specialProgramId: specialProgramId ?? null,
        services: services.map((s: {
          order: number;
          serviceTime: string;
          preServiceTime?: string | null;
          closesAt?: string | null;
        }) => ({
          order: s.order,
          serviceTime: new Date(s.serviceTime),
          preServiceTime: s.preServiceTime ? new Date(s.preServiceTime) : null,
          closesAt: s.closesAt ? new Date(s.closesAt) : null,
        })),
      });
      successResponse(res, "Attendance session started successfully", StatusCodes.CREATED, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Mark attendance for a user
   */
  public markAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, userId, markedAt, serviceOrder } = req.body;
      const result = await this.attendanceService.markAttendance(
        sessionId,
        userId,
        markedAt ? new Date(markedAt) : undefined,
        typeof serviceOrder === "number" ? serviceOrder : undefined,
      );
      successResponse(res, "Attendance marked successfully", StatusCodes.CREATED, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Get all sessions (with pagination)
   */
  public getAllSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.attendanceService.getAllSessions(page, limit);
      successResponse(res, "Attendance sessions fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Get single session details (with attendees), optionally filtered.
   * Filters: departmentIds (csv), gender, membershipType, churchStatus, lateComers.
   */
  public getSessionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const filters = parseAttendanceFilterQuery(req.query as Record<string, unknown>);
      const result = await this.attendanceService.getSessionById(id, filters);
      successResponse(res, "Attendance session fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Update a session (serviceName/date/services array)
   */
  public updateSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { serviceName, startedAt, date, serviceDayId, specialProgramId, services } = req.body;
      const data: Parameters<typeof this.attendanceService.updateSession>[1] = {};
      if (serviceName !== undefined) data.serviceName = serviceName;
      if (startedAt !== undefined) data.startedAt = new Date(startedAt);
      if (date !== undefined) data.date = new Date(date);
      if (serviceDayId !== undefined) data.serviceDayId = serviceDayId;
      if (specialProgramId !== undefined) data.specialProgramId = specialProgramId;
      if (Array.isArray(services)) {
        data.services = services.map((s: {
          order: number;
          serviceTime: string;
          preServiceTime?: string | null;
          closesAt?: string | null;
        }) => ({
          order: s.order,
          serviceTime: new Date(s.serviceTime),
          preServiceTime: s.preServiceTime ? new Date(s.preServiceTime) : null,
          closesAt: s.closesAt ? new Date(s.closesAt) : null,
        }));
      }
      const result = await this.attendanceService.updateSession(id, data);
      successResponse(res, "Attendance session updated successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Bulk mark attendance for multiple users
   */
  public bulkMarkAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, userIds } = req.body;
      const result = await this.attendanceService.bulkMarkAttendance(sessionId, userIds);
      successResponse(res, "Bulk attendance marked successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Delete a session
   */
  public deleteSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.attendanceService.deleteSession(id);
      successResponse(res, "Attendance session deleted successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Edit a single attendance record (admin: change markedAt and/or serviceOrder).
   */
  public updateAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { markedAt, serviceOrder } = req.body;
      const result = await this.attendanceService.updateAttendance(id, {
        ...(markedAt !== undefined ? { markedAt: new Date(markedAt) } : {}),
        ...(typeof serviceOrder === "number" ? { serviceOrder } : {}),
      });
      successResponse(res, "Attendance updated successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Delete a single attendance record (admin).
   */
  public deleteAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.attendanceService.deleteAttendance(id);
      successResponse(res, "Attendance deleted successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getAttendanceSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.attendanceService.getAttendanceSummary();
      successResponse(res, "Attendance summary fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getTopMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.attendanceService.getTopMembers(limit);
      successResponse(res, "Top members fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getMemberAttendanceHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const result = await this.attendanceService.getMemberAttendanceHistory(userId);
      successResponse(res, "Member attendance history fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /** Personal attendance history for the authenticated user. */
  public getMyAttendances = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized" });
        return;
      }
      const result = await this.attendanceService.getMemberAttendanceHistory(req.user.id);
      successResponse(res, "My attendance history fetched", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getAttendanceTrend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupBy = (req.query.groupBy as 'session' | 'week' | 'month') || 'session';
      const departmentId = req.query.departmentId as string | undefined;

      console.log(departmentId)
      
      const result = await this.attendanceService.getAttendanceTrend(groupBy, departmentId);
      successResponse(res, "Attendance trend fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getAttendanceRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.attendanceService.getAttendanceRate();
      successResponse(res, "Attendance rate fetched successfully", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /**
   * Export the session attendance as a PDF report.
   * Accepts the same filter query params as `getSessionById`.
   */
  public exportSessionPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filters = parseAttendanceFilterQuery(req.query as Record<string, unknown>);
    console.log("Filters:", filters);

    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      console.log(" No authenticated user");
      res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized" });
      return;
    }

    await this.attendancePdfService.streamSessionReport(
      id,
      filters,
      requestingUserId,
      res
    );

  } catch (err) {
    console.error("exportSessionPdf error:", err);
    logDevError(err);
    next(err);
  }
};

  /** Read the income matrix for a session. */
  public getSessionIncome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionIncomeService.getForSession(req.params.id);
      successResponse(res, "Session income fetched", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /** Upsert the income matrix (entries omitted from the payload are untouched). */
  public upsertSessionIncome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionIncomeService.upsertForSession(
        req.params.id,
        req.body,
        req.user?.id,
      );
      successResponse(res, "Session income saved", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  /** Soft-close: sets endedAt = now(). Reopen clears it. */
  public closeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionIncomeService.closeSession(req.params.id);
      successResponse(res, "Session closed", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public reopenSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionIncomeService.reopenSession(req.params.id);
      successResponse(res, "Session reopened", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };
}
