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
  name: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  clientId?: string;
  ingredients?: string[];
  mealType?: "breakfast" | "lunch" | "dinner" | "treats";
  special?: boolean;
}

export interface UpdateItemInput {
  categoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  ingredients?: string[];
  mealType?: "breakfast" | "lunch" | "dinner" | "treats";
  special?: boolean;
}

export interface ListItemsFilters {
  categoryId?: string;
  includeDeleted?: boolean;
  includeUnavailable?: boolean;
}

/**
 * Helper Functions
 */

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

  // Ensure price is a number (accept as-is, no conversion)
  if (data.price !== undefined) {
    const priceNum =
      typeof data.price === "string"
        ? parseFloat(data.price)
        : Number(data.price);
    if (isNaN(priceNum) || priceNum < 0) {
      throw new ItemServiceError(400, "Invalid price value", "INVALID_PRICE");
    }
    data.price = priceNum;
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
      approvalStatus: "pendingapproval", // New items require approval
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
    if (uploadedImage?.publicId) {
      const publicId = uploadedImage.publicId;
      await deleteImage(publicId).catch((err) =>
        console.error(`Failed to cleanup image ${publicId}:`, err)
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
  const query: any = { isDeleted: false };

  // Only filter by availability if includeUnavailable is not true
  if (!filters.includeUnavailable) {
    query.isAvailable = true;
  }

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

  const items = await Item.find(query).populate("category").sort({ name: 1 });

  // Use toJSON to apply model transform (converts _id to id, handles category)
  return items.map((item) => item.toJSON());
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

  const item = await Item.findOne({ _id: id, isDeleted: false }).populate(
    "category"
  );

  if (!item) {
    return null;
  }

  // Use toJSON to apply model transform (converts _id to id, handles category)
  return item.toJSON();
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
      approvalStatus: "pendingapproval", // Updates require re-approval
    };

    // Update image if new one was uploaded
    if (uploadedImage) {
      updateData.image = uploadedImage;
    }

    if (data.categoryId) {
      updateData.categoryId = new Types.ObjectId(data.categoryId);
    }

    // Ensure price is a number (accept as-is, no conversion)
    if (data.price !== undefined) {
      const priceNum =
        typeof data.price === "string"
          ? parseFloat(data.price)
          : Number(data.price);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new ItemServiceError(400, "Invalid price value", "INVALID_PRICE");
      }
      // Store price as-is without any conversion
      updateData.price = priceNum;
    }

    const updated = await Item.findOneAndUpdate(
      { _id: id, isDeleted: false, __v: oldItem.__v },
      updateData,
      { new: true, runValidators: true, session: session || undefined }
    ).populate("category");

    if (!updated) {
      // Clean up uploaded image if update failed
      if (uploadedImage?.publicId) {
        const publicId = uploadedImage.publicId;
        await deleteImage(publicId).catch((err) =>
          console.error(`Failed to cleanup image ${publicId}:`, err)
        );
      }
      throw new ItemServiceError(
        409,
        "Item has been modified by another user. Please refresh and try again.",
        "VERSION_CONFLICT"
      );
    }

    // Delete old image only after successful DB update
    if (oldImageToDelete?.publicId) {
      const publicId = oldImageToDelete.publicId;
      await deleteImage(publicId).catch((err) =>
        console.error(`Failed to delete old image ${publicId}:`, err)
      );
    }

    return updated;
  } catch (error: any) {
    // Clean up uploaded image on error
    if (uploadedImage?.publicId) {
      const publicId = uploadedImage.publicId;
      await deleteImage(publicId).catch((err) =>
        console.error(`Failed to cleanup image ${publicId}:`, err)
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
  if (item.image?.publicId) {
    const publicId = item.image.publicId;
    await deleteImage(publicId).catch((err) =>
      console.error(`Failed to delete image ${publicId}:`, err)
    );
  }

  await Item.findByIdAndDelete(id);
};

/**
 * Gets all soft-deleted items
 * @returns Array of deleted items with populated categories
 */
export const getDeletedItems = async (): Promise<any[]> => {
  const items = await Item.find({ isDeleted: true })
    .populate("category")
    .sort({ deletedAt: -1 });

  // Use toJSON to apply model transform (converts _id to id, handles category)
  return items.map((item) => item.toJSON());
};

/**
 * Gets all unavailable items
 * @returns Array of unavailable items with populated categories
 */
export const getUnavailableItems = async (): Promise<any[]> => {
  const items = await Item.find({
    isAvailable: false,
    isDeleted: false,
  })
    .populate("category")
    .sort({ name: 1 });

  // Use toJSON to apply model transform (converts _id to id, handles category)
  return items.map((item) => item.toJSON());
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

/**
 * Lists items pending approval
 * @returns Array of items with approvalStatus "pendingapproval"
 */
export const listPendingApprovals = async (): Promise<any[]> => {
  // Query for pending approval items
  // Note: The pre-hook automatically adds isDeleted: false, but we include it explicitly for clarity
  const query = Item.find({
    approvalStatus: "pendingapproval",
    isDeleted: false,
  });

  const items = await query
    .populate("category", "name id")
    .populate("approvedBy", "name id")
    .sort({ createdAt: -1 })
    .lean();

  console.log(`[listPendingApprovals] Query returned ${items.length} items`);

  // Transform _id to id for lean documents and handle populated fields
  return items.map((item: any) => {
    const result: any = {
      ...item,
      id: item._id?.toString() || item.id,
    };
    // Remove _id from result
    delete result._id;

    // Handle category if populated
    if (item.category) {
      result.category = {
        ...item.category,
        id: item.category._id?.toString() || item.category.id,
      };
      delete result.category._id;
    }

    // Handle approvedBy if populated
    if (item.approvedBy) {
      result.approvedBy = {
        ...item.approvedBy,
        id: item.approvedBy._id?.toString() || item.approvedBy.id,
      };
      delete result.approvedBy._id;
    }

    return result;
  });
};

/**
 * Approves an item
 * @param id - Item ID
 * @param approvedBy - User ID who approved
 * @returns Updated item with populated category
 * @throws {ItemServiceError} If item not found
 */
export const approveItem = async (
  id: string,
  approvedBy: string
): Promise<ItemDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  if (!Types.ObjectId.isValid(approvedBy)) {
    throw new ItemServiceError(400, "Invalid user ID", "INVALID_USER_ID");
  }

  const updated = await Item.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      approvalStatus: "approved",
      approvedBy: new Types.ObjectId(approvedBy),
      approvedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).populate("category");

  if (!updated) {
    throw new ItemServiceError(404, "Item not found", "ITEM_NOT_FOUND");
  }

  return updated;
};

/**
 * Rejects an item
 * @param id - Item ID
 * @param approvedBy - User ID who rejected
 * @returns Updated item with populated category
 * @throws {ItemServiceError} If item not found
 */
export const rejectItem = async (
  id: string,
  approvedBy: string
): Promise<ItemDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ItemServiceError(400, "Invalid item ID", "INVALID_ITEM_ID");
  }

  if (!Types.ObjectId.isValid(approvedBy)) {
    throw new ItemServiceError(400, "Invalid user ID", "INVALID_USER_ID");
  }

  const updated = await Item.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      approvalStatus: "rejected",
      approvedBy: new Types.ObjectId(approvedBy),
      approvedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).populate("category");

  if (!updated) {
    throw new ItemServiceError(404, "Item not found", "ITEM_NOT_FOUND");
  }

  return updated;
};
