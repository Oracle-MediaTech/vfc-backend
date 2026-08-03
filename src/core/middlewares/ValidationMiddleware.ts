import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { logDevError } from "../utils";

export const validate = (
  schema: ZodType<any, any>,
  property: "body" | "params" | "query" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req[property]);
      return next();
    } catch (error) {
      logDevError(error);
      if (error instanceof ZodError) {
        res.status(400).json({
          message: "Validation error",
          errors: error.issues, // i changed this to issues(errors)
        });
        return;
      }
      next(error);
    }
  };
};
