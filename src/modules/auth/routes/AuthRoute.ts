
import { Request, Response, NextFunction, Router } from 'express';
import { AuthController } from '../controllers';
import { Routes } from "../../../core/routes/interfaces";
import { authenticate } from '../../../core/middlewares/AuthMiddleware';
import { AcceptInviteSchema, ChangePasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema, VerifyTokenSchema } from '../schema/auth.schema';
import { validate } from '../../../core/middlewares';

class AuthRoute implements Routes {
    public path = '/auth';
    public router = Router();
    public userController = new AuthController();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // this.router.all(`${this.path}*`, (req: Request, res: Response, next: NextFunction) => {
        //     next()
        // })

        this.router.all(`${this.path}/*splat`, (req, res, next) => {
    next();
});
        this.router.post(`${this.path}/register`, validate(RegisterSchema), this.userController.register);

        this.router.post(`${this.path}/login`, validate(LoginSchema), this.userController.login);

        this.router.post(`${this.path}/change-password`, authenticate, validate(ChangePasswordSchema), this.userController.changePassword);

        this.router.post(`${this.path}/reset-password`, validate(ResetPasswordSchema), this.userController.resetPassword);

        this.router.post(`${this.path}/verify-token`, validate(VerifyTokenSchema), this.userController.verifyToken);

        // Public invite-acceptance flow — no `authenticate` because the user
        // is setting their password for the first time. Token in the URL is
        // the auth.
        this.router.get(`${this.path}/setup/:token`, this.userController.getSetupToken);
        this.router.post(`${this.path}/setup/:token`, validate(AcceptInviteSchema), this.userController.acceptSetupToken);
    }
}

export { AuthRoute };

