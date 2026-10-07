import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { logDevError } from "../../core/utils";
import { ExportService } from "./export.service";

export class ExportController {
  private readonly exportService: ExportService;

  constructor() {
    this.exportService = new ExportService();
  }

  public export = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const {
        tableName,
        fields,
      }: {
        tableName: string;
        fields: {
          key: string;
          label: string;
        }[];
      } = req.body;

      const xlsxFile = await this.exportService.export({
        tableName,
        fields,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tableName}.xlsx"`,
      );

      res.status(StatusCodes.OK).send(xlsxFile);
    } catch (err) {
      logDevError(err);
      next(err);
    }
  };
}