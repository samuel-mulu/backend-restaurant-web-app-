import { Request, Response, NextFunction } from "express";
import * as inventoryService from "./inventory.service";
import { validate } from "../../common/middleware/validate";
import {
  createInventorySchema,
  updateInventorySchema,
} from "./inventory.validation";

// Utility response handler
const send = (res: Response, code: number, payload: any) =>
  res.status(code).json({ success: code < 400, ...payload });

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      lowStock: req.query.lowStock === "true",
      forOrder: req.query.forOrder === "true",
    };

    const items = await inventoryService.listInventory(filters);

    return send(res, 200, { data: items });
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
    const item = await inventoryService.getInventoryById(req.params.id);
    if (!item) return send(res, 404, { message: "Inventory record not found" });

    return send(res, 200, { data: item });
  } catch (err) {
    next(err);
  }
};

export const create = [
  validate(createInventorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventory = await inventoryService.createInventory(req.body);
      return send(res, 201, {
        message: "Inventory record created successfully",
        data: inventory,
      });
    } catch (err) {
      next(err);
    }
  },
];

export const update = [
  validate(updateInventorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await inventoryService.updateInventory(
        req.params.id,
        req.body
      );

      if (!updated)
        return send(res, 404, { message: "Inventory record not found" });

      return send(res, 200, {
        message: "Inventory record updated successfully",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },
];

export const getLowStock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await inventoryService.getLowStockItems();
    return send(res, 200, { data: items });
  } catch (err) {
    next(err);
  }
};

export const listPendingApprovals = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await inventoryService.listPendingApprovals();
    return send(res, 200, {
      message: "Pending approvals retrieved",
      data: items,
    });
  } catch (err) {
    next(err);
  }
};

export const approveInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return send(res, 401, { message: "User not authenticated" });
    }

    const inventoryId = req.params.id;
    if (!inventoryId) {
      return send(res, 400, { message: "Inventory ID is required" });
    }

    const inventory = await inventoryService.approveInventory(
      inventoryId,
      userId
    );
    return send(res, 200, {
      message: "Inventory item approved successfully",
      data: inventory,
    });
  } catch (err: any) {
    if (err.status) {
      return send(res, err.status, { message: err.message });
    }
    next(err);
  }
};

export const rejectInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return send(res, 401, { message: "User not authenticated" });
    }

    const inventoryId = req.params.id;
    if (!inventoryId) {
      return send(res, 400, { message: "Inventory ID is required" });
    }

    const inventory = await inventoryService.rejectInventory(
      inventoryId,
      userId
    );
    return send(res, 200, {
      message: "Inventory item rejected successfully",
      data: inventory,
    });
  } catch (err: any) {
    if (err.status) {
      return send(res, err.status, { message: err.message });
    }
    next(err);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deleted = await inventoryService.deleteInventory(req.params.id);
    if (!deleted) {
      return send(res, 404, { message: "Inventory record not found" });
    }

    return send(res, 200, {
      message: "Inventory record deleted successfully",
      data: deleted,
    });
  } catch (err) {
    next(err);
  }
};