import { Request, Response } from "express";
import * as categoryService from "./category.service";

const send = (res: Response, status: number, data: any) => {
  return res.status(status).json({ success: true, ...data });
};

const sendError = (res: Response, err: any) => {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  console.error("Unexpected category message:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

export const create = async (req: Request, res: Response) => {
  try {
    const category = await categoryService.createCategory(req.body);
    send(res, 201, { data: category });
  } catch (err) {
    sendError(res, err);
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const categories = await categoryService.listCategories();
    send(res, 200, { data: categories });
  } catch (err) {
    sendError(res, err);
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body
    );
    send(res, 200, { data: category });
  } catch (err) {
    sendError(res, err);
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const category = await categoryService.removeCategory(req.params.id);
    send(res, 200, {
      message: "Category deleted successfully",
      data: category,
    });
  } catch (err) {
    sendError(res, err);
  }
};
