import { Types, ClientSession } from "mongoose";
import mongoose from "mongoose";
import { Item, ItemDoc, ImageInfo } from "./item.model";
import { uploadImage, deleteImage } from "../../config/cloudinary";

/**
 * Service layer for Item management
 * Handles business logic, validation, and data operations
 */

// Constants
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Custom error class for item operations
 */
export class ItemServiceError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ItemServiceError";
    Object.setPrototypeOf(this, ItemServiceError.prototype);
  }
}

export interface CreateItemInput {
  categoryId: string;
  itemCode: string;
  name: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  clientId?: string;
}

export interface UpdateItemInput {
  categoryId?: string;
  itemCode?: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
}

export interface ListItemsFilters {
  categoryId?: string;
  includeDeleted?: boolean;
}

/**
 * Helper Functions
 */

/**
 * Normalizes item code to uppercase and trims whitespace
 */
const normalizeItemCode = (code: string): string => {
  if (!code || typeof code !== "string") {
    throw new ItemServiceError(400, "Item code must be a non-empty string");
  }
  return code.trim().toUpperCase();
};

/**
 * Validates image file for size constraints
 * @throws {ItemServiceError} If validation fails
 */
const validateImageFile = (file: Express.Multer.File): void => {
  if (!file) {
    return;
  }

  if (!file.buffer || file.size > MAX_IMAGE_SIZE) {
    const maxSizeMB = MAX_IMAGE_SIZE / 1024 / 1024;
    throw new ItemServiceError(
      400,
      `Image "${
        file.originalname || "unknown"
      }" exceeds maximum size of ${maxSizeMB}MB`,
      "IMAGE_SIZE_EXCEEDED"
    );
  }
};

/**
 * Uploads a single image to Cloudinary
 * @param file - File buffer to upload
 * @param folder - Cloudinary folder path
 * @returns Uploaded image info
 * @throws {ItemServiceError} If upload fails
 */
const uploadImageToCloudinary = async (
  file: Express.Multer.File,
  folder = "menu-items"
): Promise<ImageInfo> => {
  if (!file) {
    throw new ItemServiceError(400, "No image file provided", "NO_IMAGE");
  }

  try {
    const result = await uploadImage(file.buffer, folder);
    return {
      url: result.url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    throw new ItemServiceError(
      500,
      "Failed to upload image to Cloudinary",
      "IMAGE_UPLOAD_ERROR"
    );
  }
};

/**
 * Service Functions
 */

/**
 * Creates a new item with transaction support
 * @param data - Item creation data
 * @param files - Optional image files to upload
 * @param session - Optional MongoDB session for transaction
 * @returns Created item with populated category
 * @throws {ItemServiceError} If validation fails or item already exists
 */
export const createItem = async (
  data: CreateItemInput,
  files?: Express.Multer.File[],
  session?: ClientSession
): Promise<ItemDoc> => {
  // Normalize itemCode
  data.itemCode = normalizeItemCode(data.itemCode);

  // Check for idempotency if clientId provided
  if (data.clientId) {
    const existing = await Item.findOne({ clientId: data.clientId }).session(
      session || null
    );
    if (existing) {
      await existing.populate("category");
      return existing;
    }
  }

  // Check if itemCode already exists
  const existingItem = await Item.findOne({ itemCode: data.itemCode }).session(
    session || null
  );
  if (existingItem) {
    throw new ItemServiceError(
      409,
      "Item code already exists",
      "DUPLICATE_ITEM_CODE"
    );
  }

  // Handle image
  let uploadedImage: ImageInfo | null = null;

  try {
    // Validate and upload image (take first file if multiple provided)
    if (files && files.length > 0) {
      const file = Array.isArray(files) ? files[0] : files;
      validateImageFile(file);
      uploadedImage = await uploadImageToCloudinary(file);
    }

    // Create item
    const itemData: any = {
      ...data,
      categoryId: new Types.ObjectId(data.categoryId),
    };

    // Add image if uploaded
    if (uploadedImage) {
      itemData.image = uploadedImage;
    }

    // Create without transaction for standalone MongoDB (only use session if explicitly provided)
    const created = await Item.create([itemData], {
      session: session || undefined,
    });
    await created[0].populate("category");

    return created[0];
  } catch (error: any) {
    // Clean up uploaded image on error
    if (uploadedImage) {
      await deleteImage(uploadedImage.publicId).catch((err) =>
        console.error(
          `Failed to cleanup image ${uploadedImage?.publicId}:`,
          err
        )
      );
    }
    // Re-throw as ItemServiceError if not already
    if (error instanceof ItemServiceError) {
      throw error;
    }
    throw new ItemServiceError(
      error.status || 500,
      error.message || "Failed to create item",
      error.code
    );
  }
};

/**
 * Lists items with optional filters
 * @param filters - Filter criteria
 * @returns Array of items with populated categories
 */
export const listItems = async (
  filters: ListItemsFilters = {}
): Promise<any[]> => {
  const query: any = { isAvailable: true, isDeleted: false };

  if (filters.categoryId) {
    if (!Types.ObjectId.isValid(filters.categoryId)) {
      throw new ItemServiceError(
        400,
        "Invalid category ID",
        "INVALID_CATEGORY_ID"
      );
    }
    query.categoryId = new Types.ObjectId(filters.categoryId);
  }
  if (filters.includeDeleted) {
    delete query.isDeleted;
  }

  return await Item.find(query).populate("category").sort({ name: 1 }).lean();
};

/**
 * Gets a single item by ID
 * @param id - Item ID
 * @returns Item with populated category or null if not found
 */
export const getItemById = async (id: string): Promise<any | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  return await Item.findOne({ _id: id, isDeleted: false })
    .populate("category")
    .lean();
};

/**
 * Updates an item with optimistic concurrency control
 * @param id - Item ID
 * @param data - Update data
 * @param files - Optional new image file
 * @param session - Optional MongoDB session
 * @returns Updated item with populated category
 * @throws {ItemServiceError} If validation fails or conflict detected
 */
export const updateItem = async (
  id: string,
  data: UpdateItemInput & { __v?: number },
  files?: Express.Multer.File[],
  session?: ClientSession
): Promise<ItemDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  let uploadedImage: ImageInfo | null = null;
  let oldImageToDelete: ImageInfo | null = null;

  try {
    // Get existing item
    const oldItem = await Item.findById(id).session(session || null);
    if (!oldItem || oldItem.isDeleted) {
      throw new ItemServiceError(404, "Item not found", "ITEM_NOT_FOUND");
    }

    // Optimistic concurrency control
    if (data.__v !== undefined && oldItem.__v !== data.__v) {
      throw new ItemServiceError(
        409,
        "Item has been modified by another user. Please refresh and try again.",
        "VERSION_CONFLICT"
      );
    }

    // Normalize itemCode if provided
    if (data.itemCode) {
      data.itemCode = normalizeItemCode(data.itemCode);
      // Check if itemCode is being changed and if it already exists
      if (data.itemCode !== oldItem.itemCode) {
        const existingItem = await Item.findOne({
          itemCode: data.itemCode,
          _id: { $ne: id },
        }).session(session || null);
        if (existingItem) {
          throw new ItemServiceError(
            409,
            "Item code already exists",
            "DUPLICATE_ITEM_CODE"
          );
        }
      }
    }

    // Handle image: if new image is uploaded, delete old one
    if (files && files.length > 0) {
      const file = Array.isArray(files) ? files[0] : files;
      validateImageFile(file);
      uploadedImage = await uploadImageToCloudinary(file);

      // Store old image to delete after successful update
      if (oldItem.image) {
        oldImageToDelete = oldItem.image;
      }
    }

    // Update item (remove __v from update data, it's handled by MongoDB)
    const { __v, ...updateDataWithoutVersion } = data;
    const updateData: any = {
      ...updateDataWithoutVersion,
    };

    // Update image if new one was uploaded
    if (uploadedImage) {
      updateData.image = uploadedImage;
    }

    if (data.categoryId) {
      updateData.categoryId = new Types.ObjectId(data.categoryId);
    }

    const updated = await Item.findOneAndUpdate(
      { _id: id, isDeleted: false, __v: oldItem.__v },
      updateData,
      { new: true, runValidators: true, session: session || undefined }
    ).populate("category");

    if (!updated) {
      // Clean up uploaded image if update failed
      if (uploadedImage) {
        await deleteImage(uploadedImage.publicId).catch((err) =>
          console.error(
            `Failed to cleanup image ${uploadedImage?.publicId}:`,
            err
          )
        );
      }
      throw new ItemServiceError(
        409,
        "Item has been modified by another user. Please refresh and try again.",
        "VERSION_CONFLICT"
      );
    }

    // Delete old image only after successful DB update
    if (oldImageToDelete) {
      await deleteImage(oldImageToDelete.publicId).catch((err) =>
        console.error(
          `Failed to delete old image ${oldImageToDelete?.publicId}:`,
          err
        )
      );
    }

    return updated;
  } catch (error: any) {
    // Clean up uploaded image on error
    if (uploadedImage) {
      await deleteImage(uploadedImage.publicId).catch((err) =>
        console.error(
          `Failed to cleanup image ${uploadedImage?.publicId}:`,
          err
        )
      );
    }
    // Re-throw as ItemServiceError if not already
    if (error instanceof ItemServiceError) {
      throw error;
    }
    throw new ItemServiceError(
      error.status || 500,
      error.message || "Failed to update item",
      error.code
    );
  }
};

/**
 * Soft deletes an item
 * @param id - Item ID
 * @returns Deleted item with populated category
 */
export const deleteItem = async (id: string): Promise<ItemDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  const item = await Item.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date(), isAvailable: false },
    { new: true, runValidators: true }
  ).populate("category");

  return item;
};

/**
 * Restores a soft-deleted item
 * @param id - Item ID
 * @returns Restored item with populated category
 */
export const restoreItem = async (id: string): Promise<ItemDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  const item = await Item.findByIdAndUpdate(
    id,
    { isDeleted: false, deletedAt: null, isAvailable: true },
    { new: true, runValidators: true }
  ).populate("category");

  return item;
};

/**
 * Permanently deletes an item and its images
 * @param id - Item ID
 * @throws {ItemServiceError} If item not found
 */
export const permanentDeleteItem = async (id: string): Promise<void> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  const item = await Item.findById(id);
  if (!item) {
    throw new ItemServiceError(404, "Item not found", "ITEM_NOT_FOUND");
  }

  // Delete image first
  if (item.image) {
    await deleteImage(item.image.publicId).catch((err) =>
      console.error(`Failed to delete image ${item.image?.publicId}:`, err)
    );
  }

  await Item.findByIdAndDelete(id);
};

/**
 * Gets all soft-deleted items
 * @returns Array of deleted items with populated categories
 */
export const getDeletedItems = async (): Promise<any[]> => {
  return await Item.find({ isDeleted: true })
    .populate("category")
    .sort({ deletedAt: -1 })
    .lean();
};

/**
 * Gets all unavailable items
 * @returns Array of unavailable items with populated categories
 */
export const getUnavailableItems = async (): Promise<any[]> => {
  return await Item.find({
    isAvailable: false,
    isDeleted: false,
  })
    .populate("category")
    .sort({ name: 1 })
    .lean();
};

/**
 * Updates item availability status
 * @param id - Item ID
 * @param isAvailable - New availability status
 * @returns Updated item with populated category
 */
export const updateAvailability = async (
  id: string,
  isAvailable: boolean
): Promise<ItemDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  return await Item.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isAvailable },
    { new: true, runValidators: true }
  ).populate("category");
};
