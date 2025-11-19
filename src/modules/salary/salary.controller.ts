import { Request, Response, NextFunction } from "express";
import * as salaryService from "./salary.service";
import { validate } from "../../common/middleware/validate";
import {
  createSalarySchema,
  updateSalarySchema,
  listSalarySchema,
} from "./salary.validation";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      staffId: req.query.staffId as string,
      month: req.query.month as string,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await salaryService.listSalaries(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const salary = await salaryService.getSalaryById(req.params.id);

    if (!salary) {
      res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: salary,
    });
  } catch (err) {
    next(err);
  }
};

export const create = [
  validate(createSalarySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const salary = await salaryService.createSalary(req.body, req.user._id);

      res.status(201).json({
        success: true,
        message: "Salary record created successfully",
        data: salary,
      });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({
          success: false,
          message: err.message,
        });
        return;
      }
      next(err);
    }
  },
];

export const update = [
  validate(updateSalarySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const salary = await salaryService.updateSalary(req.params.id, req.body);

      if (!salary) {
        res.status(404).json({
          success: false,
          message: "Salary record not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Salary record updated successfully",
        data: salary,
      });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({
          success: false,
          message: err.message,
        });
        return;
      }
      next(err);
    }
  },
];

export const getSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      month: req.query.month as string,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
    };

    const result = await salaryService.getSalarySummary(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getStaffHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const history = await salaryService.getStaffSalaryHistory(
      req.params.staffId
    );

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
};
