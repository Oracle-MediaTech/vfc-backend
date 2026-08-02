import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { SettingsController } from "../controllers";
import { Routes } from "../../../core/routes/interfaces";
import { authenticate, authorize } from "../../../core/middlewares/AuthMiddleware";
import { validate } from "../../../core/middlewares";
import { UpdateChurchSettingsSchema } from "../schema/settings.schema";

class SettingsRoute implements Routes {
  public path = "/settings";
  public router = Router();
  public settingsController = new SettingsController();

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

    this.router.get(`${this.path}/church`,
      authenticate,
      this.settingsController.getChurchSettings
    );

    this.router.put(`${this.path}/church`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(UpdateChurchSettingsSchema),
      this.settingsController.updateChurchSettings
    );
  }
}

export { SettingsRoute };
