import { Request, Response, NextFunction } from "express";
import { validate } from "../../common/middleware/validate";
import {
  approveAssignmentSchema,
  assignInventorySchema,
} from "../inventory/inventory.validation";
import * as assignmentService from "./inventory-assignment.service";

const send = (res: Response, code: number, payload: any) =>
  res.status(code).json({ success: code < 400, ...payload });

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    const items = await assignmentService.listAssignments({
      status: req.query.status as any,
      inventoryId: req.query.inventoryId as string | undefined,
      barmanId: req.query.barmanId as string | undefined,
      viewerRole: user?.role,
      viewerId: user?._id || user?.id,
    });
    return send(res, 200, { data: items });
  } catch (err: any) {
    if (err.status) return send(res, err.status, { message: err.message });
    next(err);
  }
};

export const assign = [
  validate(assignInventorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id || req.user?.id;
      if (!userId) {
        return send(res, 401, { message: "User not authenticated" });
      }

      const assignment = await assignmentService.createAssignment({
        inventoryId: req.params.id,
        barmanId: req.body.barmanId,
        assignedQuantity: req.body.assignedQuantity,
        assignedBy: userId,
      });

      return send(res, 201, {
        message: "Inventory assigned to barman successfully",
        data: assignment,
      });
    } catch (err: any) {
      if (err.status) return send(res, err.status, { message: err.message });
      next(err);
    }
  },
];

export const approve = [
  validate(approveAssignmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id || req.user?.id;
      if (!userId) {
        return send(res, 401, { message: "User not authenticated" });
      }
      if (req.user?.role !== "barman") {
        return send(res, 403, {
          message: "Only barman can approve assignments",
        });
      }

      const assignment = await assignmentService.approveAssignment(
        req.params.id,
        userId,
        req.body.approvedQuantity
      );

      return send(res, 200, {
        message: "Assignment approved successfully",
        data: assignment,
      });
    } catch (err: any) {
      if (err.status) return send(res, err.status, { message: err.message });
      next(err);
    }
  },
];

export const reject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return send(res, 401, { message: "User not authenticated" });
    }
    if (req.user?.role !== "barman") {
      return send(res, 403, { message: "Only barman can reject assignments" });
    }

    const assignment = await assignmentService.rejectAssignment(
      req.params.id,
      userId
    );

    return send(res, 200, {
      message: "Assignment rejected successfully",
      data: assignment,
    });
  } catch (err: any) {
    if (err.status) return send(res, err.status, { message: err.message });
    next(err);
  }
};
