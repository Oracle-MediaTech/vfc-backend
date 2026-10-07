import { Router } from "express";
import { ExportController } from "./export.controller";
import { Routes } from "../../core/routes/interfaces";
import {
  authenticate,
  authorize,
} from "../../core/middlewares/AuthMiddleware";
import { UserRole } from "@prisma/client";

class ExportRoute implements Routes {
  public path = "/export";
  public router = Router();
  public exportController = new ExportController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Export data (Admin)
    this.router.post(
      `${this.path}`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.exportController.export
    );
  }
}

export { ExportRoute };