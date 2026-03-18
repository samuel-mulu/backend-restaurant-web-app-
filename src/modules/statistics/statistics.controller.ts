import { parseEndOfDay, parseStartOfDay } from "../../common/utils/dateUtils";
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
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
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
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
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
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
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

export const getItemPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = {
      startDate: req.query.startDate
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
        : undefined,
      status: req.query.status as string,
      paymentMethod: req.query.paymentMethod as string,
      itemType: req.query.itemType as "menu" | "inventory" | "ALL",
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    };

    const data = await statisticsService.getSoldItemsPerformance(filters);

    res.status(200).json({
      success: true,
      data,
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
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
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
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
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
        ? parseStartOfDay(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? parseEndOfDay(req.query.endDate as string)
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

