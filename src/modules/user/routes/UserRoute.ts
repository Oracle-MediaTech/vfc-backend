import { Request, Response, NextFunction, Router } from "express";
import { UserController } from "../controllers";
import { Routes } from "../../../core/routes/interfaces";
import {
   authenticate,
   authorize,
} from "../../../core/middlewares/AuthMiddleware";
import { UserRole } from "@prisma/client";
import { upload } from "../../../core/utils";
import { validate } from "../../../core/middlewares";
import {
   UpdateChurchJourneySchema,
   SetPasswordSchema,
   UpdateUserSchema,
   UpdateAccountStatusSchema,
   SetPasswordWithTokenSchema,
} from "../schema/user.schema";

class UserRoute implements Routes {
   public path = "/user";
   public router = Router();
   public userController = new UserController();

   constructor() {
      this.initializeRoutes();
   }

   private initializeRoutes() {
      // Filtered, paginated user list
      this.router.get(
         `${this.path}/list`,
         authenticate,
         authorize(UserRole.ADMIN, UserRole.WORKER),
         this.userController.getFilteredUsers,
      );
     
      this.router.get(`${this.path}/export-by-department`,
         // authenticate,
         // authorize(UserRole.ADMIN, UserRole.WORKER),
         this.userController.exportUsersByDepartmentDocx
      );

<<<<<<< HEAD
    this.router.get(`${this.path}/export-by-department`,
      // authenticate,
      // authorize(UserRole.ADMIN, UserRole.WORKER),
      this.userController.exportUsersByDepartmentDocx
    );

    // Search users by name
    this.router.get(`${this.path}/search`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      this.userController.getUserByName
    );
=======
      // Search users by name
      this.router.get(
         `${this.path}/search`,
         authenticate,
         authorize(UserRole.ADMIN, UserRole.WORKER),
         this.userController.getUserByName,
      );
>>>>>>> 51fdcbecd84abcd9ea2d0cda2abc3d4f7623e40c

      // Get current user profile
      this.router.get(
         `${this.path}/me`,
         authenticate,
         this.userController.getUser,
      );

      // Bulk import members from Excel
      this.router.post(
         `${this.path}/bulk-import`,
         authenticate,
         authorize(UserRole.ADMIN),
         upload.single("file"),
         this.userController.bulkImport,
      );

      // Analyze expenses from Excel
      this.router.post(
         `${this.path}/analyze-expenses`,
         authenticate,
         authorize(UserRole.ADMIN),
         upload.single("statement"),
         this.userController.analyzeExpenses,
      );

      // Get all users
      this.router.get(
         `${this.path}`,
         authenticate,
         authorize(UserRole.ADMIN, UserRole.WORKER),
         this.userController.getAllUsers,
      );

      // Get user by ID
      this.router.get(
         `${this.path}/:id`,
         authenticate,
         authorize(UserRole.ADMIN, UserRole.WORKER),
         this.userController.getUserById,
      );

      // Update user profile
      this.router.put(
         `${this.path}/:id`,
         authenticate,
         authorize(UserRole.ADMIN),
         validate(UpdateUserSchema),
         this.userController.updateUser,
      );

      // Update church journey / role
      this.router.patch(
         `${this.path}/:id/church-journey`,
         authenticate,
         authorize(UserRole.ADMIN),
         validate(UpdateChurchJourneySchema),
         this.userController.updateChurchJourney,
      );

      // Set password for a user
      this.router.patch(
         `${this.path}/:id/set-password`,
         authenticate,
         authorize(UserRole.ADMIN),
         validate(SetPasswordSchema),
         this.userController.setPassword,
      );

      // Set password by a user themselves (after accepting an invite)
      this.router.post(
         `${this.path}/set-password`,
         validate(SetPasswordWithTokenSchema),
         this.userController.setPasswordWithToken,
      );

      // Update account lifecycle status (suspend/inactivate/archive/restore)
      this.router.patch(
         `${this.path}/:id/status`,
         authenticate,
         authorize(UserRole.ADMIN),
         validate(UpdateAccountStatusSchema),
         this.userController.updateAccountStatus,
      );

      // Delete user
      this.router.delete(
         `${this.path}/:id`,
         authenticate,
         authorize(UserRole.ADMIN),
         this.userController.deleteUser,
      );

      // Send password-setup invite email
      this.router.post(
         `${this.path}/:id/invite`,
         authenticate,
         authorize(UserRole.ADMIN),
         this.userController.sendInvite,
      );
   }
}

export { UserRoute };
