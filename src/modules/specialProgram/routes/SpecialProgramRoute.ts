import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { SpecialProgramController } from "../controllers";
import { Routes } from "../../../core/routes/interfaces";
import { authenticate, authorize } from "../../../core/middlewares/AuthMiddleware";
import { validate } from "../../../core/middlewares";
import {
  CreateSpecialProgramSchema,
  UpdateSpecialProgramSchema,
} from "../schema/specialProgram.schema";

class SpecialProgramRoute implements Routes {
  public path = "/special-programs";
  public router = Router();
  public controller = new SpecialProgramController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`,
      authenticate,
      this.controller.list,
    );

    this.router.get(`${this.path}/:id`,
      authenticate,
      this.controller.getById,
    );

    this.router.post(`${this.path}`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(CreateSpecialProgramSchema),
      this.controller.create,
    );

    this.router.put(`${this.path}/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(UpdateSpecialProgramSchema),
      this.controller.update,
    );

    this.router.delete(`${this.path}/:id`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.controller.remove,
    );
  }
}

export { SpecialProgramRoute };
