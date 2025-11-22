import { Types } from "mongoose";
import { Category, CategoryDoc } from "./category.model";

export class CategoryServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "SERVICE_ERROR"
  ) {
    super(message);
    Object.setPrototypeOf(this, CategoryServiceError.prototype);
  }
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Create Category
 */
export const createCategory = async (data: {
  name: string;
  clientId?: string;
}): Promise<CategoryDoc> => {
  const name = data.name.trim().toLowerCase();
  const escaped = escapeRegex(name);

  const exists = await Category.findOne({
    name: { $regex: `^${escaped}$`, $options: "i" },
  });

  if (exists) {
    throw new CategoryServiceError(
      409,
      `Category "${name}" already exists`,
      "DUPLICATE_CATEGORY"
    );
  }

  try {
    const category = await Category.create({
      name,
      clientId: data.clientId,
    });
    return category;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new CategoryServiceError(
        409,
        "Category already exists",
        "DUPLICATE_CATEGORY"
      );
    }
    throw new CategoryServiceError(500, "Create failed");
  }
};

/**
 * List Categories
 */
export const listCategories = async (): Promise<CategoryDoc[]> => {
  return Category.find({ isDeleted: false }).sort({ name: 1 });
};

/**
 * Update Category
 */
export const updateCategory = async (
  id: string,
  data: Partial<{ name: string }>
): Promise<CategoryDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CategoryServiceError(400, "Invalid ID", "INVALID_ID");
  }

  const category = await Category.findById(id);
  if (!category || category.isDeleted) {
    throw new CategoryServiceError(404, "Category not found", "NOT_FOUND");
  }

  if (data.name) {
    const newName = data.name.trim().toLowerCase();

    if (newName !== category.name.toLowerCase()) {
      const escaped = escapeRegex(newName);

      const exists = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: `^${escaped}$`, $options: "i" },
      });

      if (exists) {
        throw new CategoryServiceError(
          409,
          `Category "${newName}" already exists`,
          "DUPLICATE_CATEGORY"
        );
      }

      category.name = newName;
    }
  }

  try {
    await category.save();
    return category;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new CategoryServiceError(
        409,
        "Duplicate category",
        "DUPLICATE_CATEGORY"
      );
    }
    throw new CategoryServiceError(500, "Update failed", "UPDATE_ERROR");
  }
};

/**
 * Soft Delete Category
 */
export const removeCategory = async (
  id: string
): Promise<CategoryDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CategoryServiceError(400, "Invalid ID", "INVALID_ID");
  }

  const category = await Category.findById(id);
  if (!category || category.isDeleted) {
    throw new CategoryServiceError(404, "Category not found", "NOT_FOUND");
  }

  category.isDeleted = true;
  category.deletedAt = new Date();
  await category.save();

  return category;
};
