import { Request, Response, NextFunction } from "express";
import * as staffService from "./staff.service";
import { validate } from "../../common/middleware/validate";
import {
  createStaffSchema,
  updateStaffSchema,
  listStaffSchema,
} from "./staff.validation";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      role: req.query.role as any,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await staffService.listStaff(filters);

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
    const staff = await staffService.getStaffById(req.params.id);

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (err: any) {
    if (err.message === "User is not a staff member") {
      res.status(400).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

export const create = [
  validate(createStaffSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await staffService.createStaff(req.body);

      res.status(201).json({
        success: true,
        message: "Staff member created successfully",
        data: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          salary: staff.salary,
        },
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
  validate(updateStaffSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await staffService.updateStaff(req.params.id, req.body);

      if (!staff) {
        res.status(404).json({
          success: false,
          message: "Staff member not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Staff member updated successfully",
        data: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          salary: staff.salary,
        },
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

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staff = await staffService.deleteStaff(req.params.id);

    if (!staff) {
      res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Staff member deactivated successfully",
      data: {
        id: staff._id,
      },
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

export const getAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const attendance = await staffService.getStaffAttendance(req.params.id);

    res.status(200).json({
      success: true,
      data: attendance,
      message: "Attendance feature not yet implemented",
    });
  } catch (err) {
    next(err);
  }
};
