import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { UserService } from "../services";
import { InviteService } from "../../auth/services";
import { successResponse } from "../../../core/utils/responses.utils";
import { logDevError } from "../../../core/utils";
import { exportUsersByDepartment } from "../services/exportUserService";

export class UserController {
  private userService = new UserService();
  private inviteService = new InviteService();

  /** Admin generates an invite link + emails it to the user. */
  public sendInvite = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const createdById = req.user?.id;
      const { id: userId } = req.body;

      if (!createdById)
        return next(new Error("Authenticated user ID not found"));
      const result = await this.inviteService.createForUser(
        userId,
        createdById,
      );
      successResponse(res, "Invite sent", StatusCodes.OK, result);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public exportUsersByDepartmentDocx = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const document = await exportUsersByDepartment();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="members-by-department.docx"',
      );

      res.setHeader("Content-Length", document.length);

      res.status(200).send(document);
    } catch (error) {
      next(error);
    }
  }


  public setPasswordWithToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { token, password } = req.body;
      const status = await this.inviteService.accept(token, password);
      successResponse(
        res,
        "Password set successfully",
        StatusCodes.OK,
        status,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getFilteredUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const {
        page,
        limit,
        churchStatus,
        membershipType,
        role,
        accountStatus,
        departmentId,
        search,
      } = req.query;
      const result = await this.userService.getFilteredUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        churchStatus: churchStatus as any,
        membershipType: membershipType as any,
        role: role as any,
        accountStatus: accountStatus as any,
        departmentId: departmentId as string | undefined,
        search: search as string,
      });
      successResponse(
        res,
        "Users fetched successfully",
        StatusCodes.OK,
        result,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public assignPrimaryDepartment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { userId, departmentId } = req.params;
      const updatedUser = await this.userService.assignPrimaryDepartment(userId as string, departmentId as string);
      successResponse(
        res,
        "Primary department assigned successfully",
        StatusCodes.OK,
        updatedUser
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public updateAccountStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user?.id)
        return next(new Error("Authenticated user ID not found"));

      const { accountStatus } = req.body;
      const user = await this.userService.updateAccountStatus(
        req.user?.id,
        accountStatus,
      );
      successResponse(res, "Account status updated", StatusCodes.OK, user);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user?.id)
        return next(new Error("Authenticated user ID not found"));

      const user = await this.userService.updateUser(req.user?.id, req.body);
      successResponse(
        res,
        "User updated successfully",
        StatusCodes.OK,
        user,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public updateChurchJourney = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user?.id)
        return next(new Error("Authenticated user ID not found"));
      const user = await this.userService.updateChurchJourney(
        req.user?.id,
        req.body,
      );
      successResponse(
        res,
        "Church journey updated successfully",
        StatusCodes.OK,
        user,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public setPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user?.id)
        return next(new Error("Authenticated user ID not found"));
      const user = await this.userService.setPassword(
        req.user?.id,
        req.body.password,
      );
      successResponse(
        res,
        "Password set successfully",
        StatusCodes.OK,
        user,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public bulkImport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const file = req.file;
      if (!file) return next(new Error("File not uploaded"));
      const result = await this.userService.bulkImportFromExcel(file.path);
      successResponse(
        res,
        "Members imported successfully",
        StatusCodes.OK,
        result,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getAllUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const users = await this.userService.getAllUsers();
      successResponse(
        res,
        "Users fetched successfully",
        StatusCodes.OK,
        users,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user?.id)
        return next(new Error("Authenticated user ID not found"));

      const user = await this.userService.getUserById(req.user?.id);
      if (!user) return next(new Error("User not found"));
      successResponse(
        res,
        "User fetched successfully",
        StatusCodes.OK,
        user,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getUserByName = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { name } = req.query;
      console.log("Searching for user with name:", name);
      const user = await this.userService.getUserByName(name as string);
      if (!user) return next(new Error("User not found"));
      successResponse(
        res,
        "User fetched successfully",
        StatusCodes.OK,
        user,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.getUser(req?.user?.id || "");
      if (!user) return next(new Error("User not found"));
      successResponse(
        res,
        "User fetched successfully",
        StatusCodes.OK,
        user,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public analyzeExpenses = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const file = req.file;
      if (!file) return next(new Error("File not uploaded"));
      const analysisResult = await this.userService.analyzeExpenses(
        file.path,
      );
      successResponse(
        res,
        "Expenses analyzed successfully",
        StatusCodes.OK,
        analysisResult,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };

  public deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user?.id)
        return next(new Error("Authenticated user ID not found"));

      const deletedUser = await this.userService.deleteUser(req.user?.id);
      successResponse(
        res,
        "User deleted successfully",
        StatusCodes.OK,
        deletedUser,
      );
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };
}
