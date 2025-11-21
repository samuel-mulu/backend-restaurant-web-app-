import { Request, Response, NextFunction } from "express";
import * as categoryService from "./category.service";
import { CategoryServiceError } from "./category.service";

/**
 * Error handler for category operations
 * Provides consistent error response format
 */
const handleError = (err: any, res: Response) => {
  // Handle CategoryServiceError
  if (err instanceof CategoryServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Handle validation errors
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

  // Handle duplicate key errors (MongoDB unique index)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: "Category already exists",
      code: "DUPLICATE_CATEGORY",
    });
  }

  // Handle errors with status property
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.message || "An error occurred",
      code: err.code,
    });
  }

  // Handle unexpected errors
  console.error("Category controller error:", err);
  return res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
};

/**
 * Creates a new category
 */
export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

/**
 * Lists all categories
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.listCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Updates an existing category
 */
export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};

/**
 * Deletes a category
 */
export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category = await categoryService.removeCategory(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    res.json({
      success: true,
      message: "Category deleted successfully",
      data: category,
    });
  } catch (err: any) {
    handleError(err, res);
  }
};
