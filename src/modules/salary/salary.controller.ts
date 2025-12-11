import { Request, Response, NextFunction } from "express";
import * as salaryService from "./salary.service";
import { validate } from "../../common/middleware/validate";
import {
  createSalarySchema,
  updateSalarySchema,
  listSalarySchema,
  createWithdrawalSchema,
  createPaymentSchema,
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

export const deleteSalary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await salaryService.deleteSalary(req.params.id);

    res.status(200).json({
      success: true,
      message: "Salary record deleted successfully",
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
};

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

/* ---------------------- WITHDRAWAL CONTROLLERS ---------------------- */

export const createWithdrawal = [
  validate(createWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const withdrawal = await salaryService.createWithdrawal(
        req.params.id,
        req.body,
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: "Withdrawal created successfully",
        data: withdrawal,
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

export const listWithdrawals = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const withdrawals = await salaryService.listWithdrawals(req.params.id);

    res.status(200).json({
      success: true,
      data: withdrawals,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteWithdrawal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await salaryService.deleteWithdrawal(req.params.withdrawalId);

    res.status(200).json({
      success: true,
      message: "Withdrawal deleted successfully",
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
};

/* ---------------------- PAYMENT CONTROLLERS ---------------------- */

export const createPayment = [
  validate(createPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const payment = await salaryService.createPayment(
        req.params.id,
        req.body,
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        data: payment,
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

export const listPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payments = await salaryService.listPayments(req.params.id);

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

export const deletePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await salaryService.deletePayment(req.params.paymentId);

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
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
};

/* ---------------------- COUNTDOWN CONTROLLER ---------------------- */

export const getCountdown = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const countdown = await salaryService.calculateCountdown(req.params.id);

    res.status(200).json({
      success: true,
      data: countdown,
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
};

/* ---------------------- NET AMOUNT CONTROLLER ---------------------- */

export const getNetAmount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const netAmount = await salaryService.getNetAmount(req.params.id);

    res.status(200).json({
      success: true,
      data: { netAmount },
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
};
