import { NextFunction, Request, Response } from "express";
import { parseEndOfDay, parseStartOfDay } from "../../common/utils/dateUtils";
import { OrderStatus } from "../orders/order.model";
import * as waiterService from "./waiter.service";

const requireWaiterUser = (req: Request, res: Response) => {
  if (!req.user?._id) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  return req.user;
};

const parseStatus = (
  status: unknown
): OrderStatus | OrderStatus[] | undefined => {
  if (!status || status === "ALL") return undefined;
  if (Array.isArray(status)) {
    return status.filter(Boolean) as OrderStatus[];
  }
  if (typeof status === "string") {
    if (status.includes(",")) {
      return status.split(",").map((s) => s.trim()) as OrderStatus[];
    }
    return status as OrderStatus;
  }
  return undefined;
};

const parseMonthYear = (req: Request) => {
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const month = req.query.month
    ? parseInt(String(req.query.month), 10)
    : undefined;
  return {
    year: year && !Number.isNaN(year) ? year : undefined,
    month: month && !Number.isNaN(month) ? month : undefined,
  };
};

const handleKnownError = (
  err: unknown,
  res: Response,
  next: NextFunction,
  fallback: string
) => {
  const error = err as { status?: number; message?: string };
  if (error?.status) {
    res.status(error.status).json({
      success: false,
      message: error.message || fallback,
    });
    return;
  }
  next(err);
};

export const getMySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const startDate = req.query.startDate
      ? parseStartOfDay(String(req.query.startDate))
      : undefined;
    const endDate = req.query.endDate
      ? parseEndOfDay(String(req.query.endDate))
      : undefined;

    const data = await waiterService.getMySummary(user._id, user.name, {
      status: parseStatus(req.query.status),
      startDate,
      endDate,
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load waiter summary");
  }
};

export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const startDate = req.query.startDate
      ? parseStartOfDay(String(req.query.startDate))
      : undefined;
    const endDate = req.query.endDate
      ? parseEndOfDay(String(req.query.endDate))
      : undefined;

    const result = await waiterService.getMyOrders(user._id, {
      status: parseStatus(req.query.status),
      startDate,
      endDate,
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 20,
    });

    res.status(200).json(result);
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load waiter orders");
  }
};

export const getMySalary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const { month, year } = parseMonthYear(req);
    const data = await waiterService.getMySalary(user._id, month, year);
    res.status(200).json({ success: true, data });
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load salary");
  }
};

export const getMySalaryById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const salary = await waiterService.getMySalaryById(req.params.id, user._id);
    res.status(200).json({ success: true, data: salary });
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load salary");
  }
};

export const getMyCountdown = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const countdown = await waiterService.getMyCountdown(
      req.params.id,
      user._id
    );
    res.status(200).json({ success: true, data: countdown });
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load countdown");
  }
};

export const getMyWithdrawals = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const withdrawals = await waiterService.getMyWithdrawals(
      req.params.id,
      user._id
    );
    res.status(200).json({ success: true, data: withdrawals });
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load withdrawals");
  }
};

export const getMyPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireWaiterUser(req, res);
    if (!user) return;

    const payments = await waiterService.getMyPayments(req.params.id, user._id);
    res.status(200).json({ success: true, data: payments });
  } catch (err) {
    handleKnownError(err, res, next, "Failed to load payments");
  }
};
