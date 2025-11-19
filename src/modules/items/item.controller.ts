import { Request, Response, NextFunction } from "express";
import * as itemService from "./item.service";

interface RequestWithFiles extends Request {
  files?: Express.Multer.File[];
}

const handleError = (err: any, res: Response) => {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: Object.values(err.errors).map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  console.error("Item controller error:", err);
  return res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
};

export const create = async (
  req: RequestWithFiles,
  res: Response,
  next: NextFunction
) => {
  try {
    const item = await itemService.createItem(req.body, req.files);
    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      type: req.query.type as any,
      productType: req.query.productType as any,
      categoryId: req.query.categoryId as string,
      includeDeleted: req.query.includeDeleted === "true",
    };

    const items = await itemService.listItems(filters);
    res.json({
      success: true,
      data: items,
    });
  } catch (err: any) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await itemService.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }
    res.json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    next(err);
  }
};

export const update = async (
  req: RequestWithFiles,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const imagesToKeep = JSON.parse(req.body.imagesToKeep || "[]");

    const item = await itemService.updateItem(
      id,
      req.body,
      req.files,
      imagesToKeep
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

export const updateStock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { stock, operation } = req.body;

    if (stock === undefined) {
      return res.status(400).json({
        success: false,
        error: "Stock value is required",
      });
    }

    const item = await itemService.updateStock(id, {
      stock: Number(stock),
      operation: operation || "set",
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const item = await itemService.deleteItem(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found or already deleted",
      });
    }

    res.json({
      success: true,
      message: "Item has been soft deleted",
      data: item,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

export const restore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const item = await itemService.restoreItem(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Deleted item not found",
      });
    }

    res.json({
      success: true,
      message: "Item has been restored",
      data: item,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

export const permanentDelete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await itemService.permanentDeleteItem(req.params.id);
    res.json({
      success: true,
      message: "Item has been permanently deleted",
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

export const getDeleted = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await itemService.getDeletedItems();
    res.json({
      success: true,
      data: items,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getUnavailable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await itemService.getUnavailableItems();
    res.json({
      success: true,
      data: items,
    });
  } catch (err: any) {
    next(err);
  }
};

export const availability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const item = await itemService.updateAvailability(
      req.params.id,
      req.body.isAvailable
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    res.json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};
