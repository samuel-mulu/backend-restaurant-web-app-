// controllers/item.controller.ts
import { Request, Response } from "express";
import * as itemService from "./item.service";
import { ItemServiceError } from "./item.service";

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

/* -------------------------- Unified Response Helper ------------------------- */
const sendSuccess = (
  res: Response,
  data: any = null,
  message = "Success",
  status = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

/* -------------------------- Unified Error Handler --------------------------- */
const sendError = (res: Response, err: any) => {
  if (err instanceof ItemServiceError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      details: Object.values(err.errors).map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  console.error("Unhandled Item Error:", err);

  return res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
};

/* ------------------------------- Controllers -------------------------------- */

/**
 * Parse FormData body fields to proper types
 */
const parseFormDataBody = (body: any) => {
  const parsed: any = { ...body };

  // Parse price (can be string from FormData)
  if (parsed.price !== undefined) {
    parsed.price =
      typeof parsed.price === "string"
        ? parseFloat(parsed.price)
        : Number(parsed.price);
    if (isNaN(parsed.price)) {
      throw new ItemServiceError(400, "Invalid price value", "INVALID_PRICE");
    }
  }

  // Parse isAvailable (can be string from FormData)
  if (parsed.isAvailable !== undefined) {
    if (typeof parsed.isAvailable === "string") {
      parsed.isAvailable = parsed.isAvailable === "true";
    } else {
      parsed.isAvailable = Boolean(parsed.isAvailable);
    }
  }

  return parsed;
};

export const create = async (req: RequestWithFile, res: Response) => {
  try {
    const file = req.file ? [req.file] : undefined;
    const parsedBody = parseFormDataBody(req.body);
    const item = await itemService.createItem(parsedBody, file);

    return sendSuccess(res, item, "Item created successfully", 201);
  } catch (err) {
    return sendError(res, err);
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const filters = {
      categoryId: req.query.categoryId as string,
      includeDeleted: req.query.includeDeleted === "true",
      includeUnavailable: req.query.includeUnavailable === "true",
    };

    const items = await itemService.listItems(filters);
    return sendSuccess(res, items);
  } catch (err) {
    return sendError(res, err);
  }
};

export const get = async (req: Request, res: Response) => {
  try {
    const item = await itemService.getItemById(req.params.id);
    if (!item) {
      return sendError(res, new ItemServiceError(404, "Item not found"));
    }

    return sendSuccess(res, item);
  } catch (err) {
    return sendError(res, err);
  }
};

export const update = async (req: RequestWithFile, res: Response) => {
  try {
    const file = req.file ? [req.file] : undefined;
    const parsedBody = parseFormDataBody(req.body);

    const item = await itemService.updateItem(req.params.id, parsedBody, file);
    if (!item) {
      return sendError(res, new ItemServiceError(404, "Item not found"));
    }

    return sendSuccess(res, item, "Item updated successfully");
  } catch (err) {
    return sendError(res, err);
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const item = await itemService.deleteItem(req.params.id);
    if (!item) {
      return sendError(res, new ItemServiceError(404, "Item not found"));
    }

    return sendSuccess(res, item, "Item soft-deleted");
  } catch (err) {
    return sendError(res, err);
  }
};

export const restore = async (req: Request, res: Response) => {
  try {
    const item = await itemService.restoreItem(req.params.id);
    if (!item) {
      return sendError(res, new ItemServiceError(404, "Item not found"));
    }

    return sendSuccess(res, item, "Item restored");
  } catch (err) {
    return sendError(res, err);
  }
};

export const permanentDelete = async (req: Request, res: Response) => {
  try {
    await itemService.permanentDeleteItem(req.params.id);
    return sendSuccess(res, null, "Item permanently deleted");
  } catch (err) {
    return sendError(res, err);
  }
};

export const getDeleted = async (_req: Request, res: Response) => {
  try {
    const items = await itemService.getDeletedItems();
    return sendSuccess(res, items);
  } catch (err) {
    return sendError(res, err);
  }
};

export const getUnavailable = async (_req: Request, res: Response) => {
  try {
    const items = await itemService.getUnavailableItems();
    return sendSuccess(res, items);
  } catch (err) {
    return sendError(res, err);
  }
};

export const availability = async (req: Request, res: Response) => {
  try {
    const item = await itemService.updateAvailability(
      req.params.id,
      req.body.isAvailable
    );

    if (!item) {
      return sendError(res, new ItemServiceError(404, "Item not found"));
    }

    return sendSuccess(res, item, "Availability updated");
  } catch (err) {
    return sendError(res, err);
  }
};
