import { Request, Response, NextFunction, Router } from 'express';
import { DepartmentController } from '../controllers';
import { Routes } from "../../../core/routes/interfaces";
import { authenticate, authorize } from '../../../core/middlewares/AuthMiddleware';
import { UserRole } from '@prisma/client';
import { upload } from '../../../core/utils';
import { validate } from '../../../core/middlewares';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  AssignHeadSchema,
  AssignMembersSchema,
  RemoveMembersSchema,
  AssignAssistantsSchema,
  RemoveAssistantsSchema,
  AssignPositionSchema,
} from '../schema/department.schema';

class DepartmentRoute implements Routes {
  public path = '/departments';
  public router = Router();
  public departmentController = new DepartmentController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Create a department
    this.router.post(`${this.path}`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(CreateDepartmentSchema),
      this.departmentController.createDepartment
    );

    // Bulk import departments from Excel
    this.router.post(`${this.path}/bulk-import`,
      authenticate,
      authorize(UserRole.ADMIN),
      upload.single("file"),
      this.departmentController.bulkImport
    );

    // Get all departments (paginated)
    this.router.get(`${this.path}`,
      authenticate,
      this.departmentController.getAllDepartments
    );

    // Get department by ID
    this.router.get(`${this.path}/:id`,
      authenticate,
      this.departmentController.getDepartmentById
    );

    // Update department
    this.router.put(`${this.path}/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(UpdateDepartmentSchema),
      this.departmentController.updateDepartment
    );

    // Delete department
    this.router.delete(`${this.path}/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.departmentController.deleteDepartment
    );

    // Assign head
    this.router.patch(`${this.path}/:id/head`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(AssignHeadSchema),
      this.departmentController.assignHead
    );

    // Remove head
    this.router.delete(`${this.path}/:id/head`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.departmentController.removeHead
    );

    // Add members
    this.router.post(`${this.path}/:id/members`,
      authenticate,
      authorize(UserRole.ADMIN, UserRole.WORKER),
      validate(AssignMembersSchema),
      this.departmentController.addMembers
    );

    // Remove members
    this.router.delete(`${this.path}/:id/members`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(RemoveMembersSchema),
      this.departmentController.removeMembers
    );

    this.router.post(`${this.path}/:id/assistants`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(AssignAssistantsSchema),
      this.departmentController.addAssistants
    );

    this.router.delete(`${this.path}/:id/assistants`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(RemoveAssistantsSchema),
      this.departmentController.removeAssistants
    );

    // Per-(user × dept) Position assignments. Admins assign, but any
    // authenticated user can read the list (so dept exec UIs can show
    // current titleholders).
    this.router.get(`${this.path}/:id/positions`,
      authenticate,
      this.departmentController.listPositions
    );

    this.router.post(`${this.path}/:id/positions`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(AssignPositionSchema),
      this.departmentController.assignPosition
    );

    this.router.delete(`${this.path}/:id/positions/:positionId/users/:userId`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.departmentController.removePosition
    );
  }
}

export { DepartmentRoute };
