import { Request, Response, NextFunction } from "express";
import * as shiftService from "./shifts.service";

export const start = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staffId = req.body.staffId || req.user?._id;

    // If user is not owner, they can only start their own shift
    if (req.user?.role !== "owner" && staffId !== req.user?._id) {
      return res.status(403).json({
        success: false,
        message: "You can only start your own shift",
      });
    }

    const shift = await shiftService.startShift({
      staffId,
      notes: req.body.notes,
      clientId: req.body.clientId,
    });

    res.status(201).json({
      success: true,
      message: "Shift started successfully",
      data: shift,
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

export const end = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await shiftService.endShift(req.params.id, {
      endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      notes: req.body.notes,
    });

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    // If user is not owner, they can only end their own shift
    if (
      req.user?.role !== "owner" &&
      shift.staffId.toString() !== req.user?._id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only end your own shift",
      });
    }

    res.status(200).json({
      success: true,
      message: "Shift ended successfully",
      data: shift,
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

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      staffId:
        (req.query.staffId as string) ||
        (req.user?.role !== "owner" ? req.user?._id : undefined),
      status: req.query.status as any,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await shiftService.listShifts(filters);

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
    const shift = await shiftService.getShiftById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    // If user is not owner, they can only view their own shifts
    if (
      req.user?.role !== "owner" &&
      shift.staffId.toString() !== req.user?._id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

export const getActive = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let staffId: string | undefined = req.params.staffId || req.user?._id;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required",
      });
    }

    // TypeScript type narrowing
    const staffIdString: string = staffId;

    // If user is not owner, they can only view their own active shift
    if (req.user?.role !== "owner" && staffIdString !== req.user?._id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const shift = await shiftService.getActiveShift(staffIdString);

    res.status(200).json({
      success: true,
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

export const getHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staffId = req.params.staffId || req.user?._id;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required",
      });
    }

    // If user is not owner, they can only view their own history
    if (req.user?.role !== "owner" && staffId !== req.user?._id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const shifts = await shiftService.getShiftHistory(staffId);

    res.status(200).json({
      success: true,
      data: shifts,
    });
  } catch (err) {
    next(err);
  }
};

export const getRevenue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const revenue = await shiftService.calculateShiftRevenue(req.params.id);

    res.status(200).json({
      success: true,
      data: { revenue },
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
