import { Types } from "mongoose";
import { Category, CategoryDoc } from "./category.model";

/**
 * Custom error class for category operations
 */
export class CategoryServiceError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "CategoryServiceError";
    Object.setPrototypeOf(this, CategoryServiceError.prototype);
  }
}

/**
 * Creates a new category
 * @param data - Category creation data
 * @returns Created category
 * @throws {CategoryServiceError} If validation fails or category already exists
 */
export const createCategory = async (data: {
  name: string;
}): Promise<CategoryDoc> => {
  // Normalize name
  const name = data.name.trim();

  // Check if category with same name already exists
  const existing = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existing) {
    throw new CategoryServiceError(
      409,
      `Category "${name}" already exists`,
      "DUPLICATE_CATEGORY"
    );
  }

  try {
    const category = await Category.create({
      name,
    });
    return category;
  } catch (error: any) {
    // Handle duplicate key error (unique index violation)
    if (error.code === 11000) {
      throw new CategoryServiceError(
        409,
        `Category "${name}" already exists`,
        "DUPLICATE_CATEGORY"
      );
    }
    // Re-throw CategoryServiceError
    if (error instanceof CategoryServiceError) {
      throw error;
    }
    // Handle validation errors
    if (error.name === "ValidationError") {
      throw new CategoryServiceError(
        400,
        "Validation error",
        "VALIDATION_ERROR"
      );
    }
    throw new CategoryServiceError(
      500,
      "Failed to create category",
      "CREATE_ERROR"
    );
  }
};

/**
 * Lists all categories
 * @returns Array of categories
 */
export const listCategories = async (): Promise<CategoryDoc[]> => {
  return await Category.find().sort({ name: 1 });
};

/**
 * Updates an existing category
 * @param id - Category ID
 * @param data - Update data
 * @returns Updated category or null if not found
 * @throws {CategoryServiceError} If validation fails or category already exists
 */
// ======================
// Category Update Service
// ======================

export const updateCategory = async (
  id: string,
  data: Partial<Pick<CategoryDoc, "name">>
): Promise<CategoryDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CategoryServiceError(400, "Invalid category ID", "INVALID_ID");
  }

  // Get existing category
  const category = await Category.findById(id);
  if (!category) {
    throw new CategoryServiceError(404, "Category not found", "NOT_FOUND");
  }

  // -----------------------
  // Handle Name Update
  // -----------------------
  if (data.name !== undefined) {
    const normalizedName = data.name.trim();
    const currentName = category.name.trim();

    // Only check if name is changing
    if (normalizedName.toLowerCase() !== currentName.toLowerCase()) {
      // Escape regex special characters
      const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const existing = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${escaped}$`, "i") },
      });

      if (existing) {
        throw new CategoryServiceError(
          409,
          `Category "${normalizedName}" already exists`,
          "DUPLICATE_CATEGORY"
        );
      }
    }

    data.name = normalizedName;
  }

  // -----------------------
  // Update document
  // -----------------------
  try {
    const updated = await Category.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    return updated;
  } catch (error: any) {
    // Mongo duplicate key (from unique constraints)
    if (error.code === 11000) {
      throw new CategoryServiceError(
        409,
        "A category with this name already exists.",
        "DUPLICATE_CATEGORY"
      );
    }

    // Rethrow custom errors
    if (error instanceof CategoryServiceError) throw error;

    // Validation errors
    if (error.name === "ValidationError") {
      throw new CategoryServiceError(
        400,
        "Validation error",
        "VALIDATION_ERROR"
      );
    }

    // Generic server error
    throw new CategoryServiceError(
      500,
      "Failed to update category",
      "UPDATE_ERROR"
    );
  }
};

/**
 * Deletes a category
 * @param id - Category ID
 * @returns Deleted category or null if not found
 * @throws {CategoryServiceError} If category not found
 */
export const removeCategory = async (
  id: string
): Promise<CategoryDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CategoryServiceError(400, "Invalid category ID", "INVALID_ID");
  }

  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    throw new CategoryServiceError(404, "Category not found", "NOT_FOUND");
  }

  return category;
};
