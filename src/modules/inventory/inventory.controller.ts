import { Request, Response, NextFunction } from "express";
import * as inventoryService from "./inventory.service";
import { validate } from "../../common/middleware/validate";
import {
  createInventorySchema,
  updateInventorySchema,
  purchaseSchema,
} from "./inventory.validation";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      lowStock: req.query.lowStock === "true",
    };

    const items = await inventoryService.listInventory(filters);

    res.status(200).json({
      success: true,
      data: items,
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
    const inventory = await inventoryService.getInventoryById(req.params.id);

    if (!inventory) {
      res.status(404).json({
        success: false,
        message: "Inventory record not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (err) {
    next(err);
  }
};

export const create = [
  validate(createInventorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventory = await inventoryService.createInventory(req.body);

      res.status(201).json({
        success: true,
        message: "Inventory record created successfully",
        data: inventory,
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
  validate(updateInventorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventory = await inventoryService.updateInventory(
        req.params.id,
        req.body
      );

      if (!inventory) {
        res.status(404).json({
          success: false,
          message: "Inventory record not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Inventory record updated successfully",
        data: inventory,
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

export const recordPurchase = [
  validate(purchaseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const inventory = await inventoryService.recordPurchase(
        req.params.id,
        req.body,
        req.user._id
      );

      res.status(200).json({
        success: true,
        message: "Purchase recorded successfully",
        data: inventory,
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

export const getLowStock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await inventoryService.getLowStockItems();

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (err) {
    next(err);
  }
};

export const getPurchaseHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const history = await inventoryService.getPurchaseHistory(req.params.id);

    res.status(200).json({
      success: true,
      data: history,
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
