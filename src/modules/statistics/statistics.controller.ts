import { NextFunction, Request, Response } from "express";
import * as statisticsService from "./statistics.service";

export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dateRange = {
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
    };

    const stats = await statisticsService.getDashboardStats(dateRange);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

export const getSales = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? (() => {
            const d = new Date(req.query.endDate as string);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : undefined,
      cashierId: req.query.cashierId as string,
    };

    const analytics = await statisticsService.getSalesAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? (() => {
            const d = new Date(req.query.endDate as string);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : undefined,
      limit: req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined,
      status: req.query.status as string,
    };

    const analytics = await statisticsService.getProductAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

export const getStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? (() => {
            const d = new Date(req.query.endDate as string);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : undefined,
    };

    const performance = await statisticsService.getStaffPerformance(filters);

    res.status(200).json({
      success: true,
      data: performance,
    });
  } catch (err) {
    next(err);
  }
};

export const getInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? (() => {
            const d = new Date(req.query.endDate as string);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : undefined,
      status: req.query.status as string,
    };

    const analytics = await statisticsService.getInventoryAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

export const getComprehensive = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      startDate: req.query.startDate
        ? (() => {
            const d = new Date(req.query.startDate as string);
            d.setHours(0, 0, 0, 0);
            return d;
          })()
        : undefined,
      endDate: req.query.endDate
        ? (() => {
            const d = new Date(req.query.endDate as string);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : undefined,
      status: req.query.status as string,
    };

    const analytics = await statisticsService.getComprehensiveAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

