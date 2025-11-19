import { Types, ClientSession } from "mongoose";
import mongoose from "mongoose";
import { Item, ItemDoc, ImageInfo } from "./item.model";
import { uploadImage, deleteImage } from "../../config/cloudinary";

/**
 * Service layer for Item management
 * Handles business logic, validation, and data operations
 */

// Constants
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Custom error class for item operations
 */
export class ItemServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ItemServiceError";
    Object.setPrototypeOf(this, ItemServiceError.prototype);
  }
}

export interface CreateItemInput {
  type: "food" | "beverage";
  categoryId: string;
  itemCode: string;
  sku?: string;
  name: string;
  description?: string;
  price?: number;
  productType?: "menu" | "inventory";
  stock?: number;
  unit?: string;
  isAvailable?: boolean;
  clientId?: string;
}

export interface UpdateItemInput {
  type?: "food" | "beverage";
  categoryId?: string;
  itemCode?: string;
  sku?: string;
  name?: string;
  description?: string;
  price?: number;
  productType?: "menu" | "inventory";
  stock?: number;
  unit?: string;
  isAvailable?: boolean;
}

export interface UpdateStockInput {
  stock: number;
  operation?: "set" | "increment" | "decrement";
}

export interface ListItemsFilters {
  type?: "food" | "beverage";
  productType?: "menu" | "inventory";
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
 * Normalizes SKU to uppercase and trims whitespace
 */
const normalizeSku = (sku?: string): string | undefined => {
  if (!sku) return undefined;
  if (typeof sku !== "string") {
    throw new ItemServiceError(400, "SKU must be a string");
  }
  return sku.trim().toUpperCase();
};

/**
 * Validates image files for count and size constraints
 * @throws {ItemServiceError} If validation fails
 */
const validateImageFiles = (files: Express.Multer.File[]): void => {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  if (files.length > MAX_IMAGES) {
    throw new ItemServiceError(
      400,
      `Maximum ${MAX_IMAGES} images allowed per item`,
      "MAX_IMAGES_EXCEEDED"
    );
  }

  for (const file of files) {
    if (!file.buffer || file.size > MAX_IMAGE_SIZE) {
      const maxSizeMB = MAX_IMAGE_SIZE / 1024 / 1024;
      throw new ItemServiceError(
        400,
        `Image "${file.originalname || "unknown"}" exceeds maximum size of ${maxSizeMB}MB`,
        "IMAGE_SIZE_EXCEEDED"
      );
    }
  }
};

/**
 * Uploads images to Cloudinary
 * @param files - Array of file buffers to upload
 * @param folder - Cloudinary folder path
 * @returns Array of uploaded image info
 */
const uploadImagesToCloudinary = async (
  files: Express.Multer.File[],
  folder = "menu-items"
): Promise<ImageInfo[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    files.map((file) => uploadImage(file.buffer, folder))
  );

  const successful = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => {
      const result = r as PromiseFulfilledResult<any>;
      return {
        url: result.value.url,
        publicId: result.value.public_id,
      };
    });

  // Log failed uploads
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(
      `Failed to upload ${failed.length} image(s) to Cloudinary`,
      failed.map((r) => (r as PromiseRejectedResult).reason)
    );
  }

  return successful;
};

/**
 * Deduplicates images by publicId to prevent duplicate uploads
 * @param existingImages - Currently stored images
 * @param newImages - Newly uploaded images
 * @returns Combined array with unique images
 */
const deduplicateImages = (
  existingImages: ImageInfo[],
  newImages: ImageInfo[]
): ImageInfo[] => {
  if (!newImages || newImages.length === 0) {
    return existingImages || [];
  }

  const existingPublicIds = new Set(
    (existingImages || []).map((img) => img.publicId)
  );
  const uniqueNewImages = newImages.filter(
    (img) => img.publicId && !existingPublicIds.has(img.publicId)
  );

  return [...(existingImages || []), ...uniqueNewImages];
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
  // Normalize itemCode and SKU
  data.itemCode = normalizeItemCode(data.itemCode);
  if (data.sku) {
    data.sku = normalizeSku(data.sku);
  }

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
    throw new ItemServiceError(409, "Item code already exists", "DUPLICATE_ITEM_CODE");
  }

  // Check if SKU already exists (if provided)
  if (data.sku) {
    const existingSku = await Item.findOne({ sku: data.sku }).session(
      session || null
    );
    if (existingSku) {
      throw new ItemServiceError(409, "SKU already exists", "DUPLICATE_SKU");
    }
  }

  // Validate productType and stock
  if (data.productType === "menu") {
    data.stock = undefined;
  } else if (data.productType === "inventory") {
    if (data.stock !== undefined && data.stock < 0) {
      throw new ItemServiceError(
        400,
        "Stock cannot be negative",
        "INVALID_STOCK"
      );
    }
  }

  // Handle images with transaction
  let uploadedImages: ImageInfo[] = [];
  const dbSession = session || (await mongoose.startSession());

  try {
    if (!session) {
      dbSession.startTransaction();
    }

    // Validate and upload images
    if (files && files.length > 0) {
      validateImageFiles(files);
      uploadedImages = await uploadImagesToCloudinary(files);
    }

    // Create item
    const itemData: any = {
      ...data,
      images: uploadedImages,
      categoryId: new Types.ObjectId(data.categoryId),
    };

    const [created] = await Item.create([itemData], { session: dbSession });
    await created.populate("category");

    if (!session) {
      await dbSession.commitTransaction();
    }

    return created;
  } catch (error: any) {
    if (!session) {
      await dbSession.abortTransaction();
    }
    // Clean up uploaded images on error
    if (uploadedImages && uploadedImages.length > 0) {
      await Promise.allSettled(
        uploadedImages.map((img: ImageInfo) =>
          deleteImage(img.publicId).catch((err) =>
            console.error(`Failed to cleanup image ${img.publicId}:`, err)
          )
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
  } finally {
    if (!session) {
      dbSession.endSession();
    }
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

  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.productType) {
    query.productType = filters.productType;
  }
  if (filters.categoryId) {
    if (!Types.ObjectId.isValid(filters.categoryId)) {
      throw new ItemServiceError(400, "Invalid category ID", "INVALID_CATEGORY_ID");
    }
    query.categoryId = new Types.ObjectId(filters.categoryId);
  }
  if (filters.includeDeleted) {
    delete query.isDeleted;
  }

  return await Item.find(query)
    .populate("category")
    .sort({ name: 1 })
    .lean();
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

export const updateItem = async (
  id: string,
  data: UpdateItemInput & { __v?: number },
  files?: Express.Multer.File[],
  imagesToKeep: string[] = [],
  session?: ClientSession
): Promise<ItemDoc | null> => {
  const dbSession = session || (await mongoose.startSession());
  let uploadedImages: ImageInfo[] = [];

  try {
    if (!session) {
      dbSession.startTransaction();
    }

    // Get existing item
    const oldItem = await Item.findById(id).session(dbSession);
    if (!oldItem || oldItem.isDeleted) {
      throw { status: 404, message: "Item not found" };
    }

    // Optimistic concurrency control
    if (data.__v !== undefined && oldItem.__v !== data.__v) {
      throw {
        status: 409,
        message:
          "Item has been modified by another user. Please refresh and try again.",
      };
    }

    // Normalize itemCode and SKU if provided
    if (data.itemCode) {
      data.itemCode = normalizeItemCode(data.itemCode);
      // Check if itemCode is being changed and if it already exists
      if (data.itemCode !== oldItem.itemCode) {
        const existingItem = await Item.findOne({
          itemCode: data.itemCode,
          _id: { $ne: id },
        }).session(dbSession);
        if (existingItem) {
          throw { status: 409, message: "Item code already exists" };
        }
      }
    }

    if (data.sku !== undefined) {
      data.sku = normalizeSku(data.sku);
      // Check if SKU is being changed and if it already exists
      if (data.sku && data.sku !== oldItem.sku) {
        const existingSku = await Item.findOne({
          sku: data.sku,
          _id: { $ne: id },
        }).session(dbSession);
        if (existingSku) {
          throw { status: 409, message: "SKU already exists" };
        }
      }
    }

    // Validate productType and stock
    if (data.productType === "menu" || oldItem.productType === "menu") {
      data.stock = undefined;
    } else if (
      data.productType === "inventory" ||
      oldItem.productType === "inventory"
    ) {
      if (data.stock !== undefined && data.stock < 0) {
        throw { status: 400, message: "Stock cannot be negative" };
      }
    }

    // Handle images
    let finalImages: ImageInfo[] = oldItem.images || [];
    let imagesToDelete: ImageInfo[] = [];

    if (files && files.length > 0) {
      validateImageFiles(files);
      uploadedImages = await uploadImagesToCloudinary(files);
    }

    // Merge images: keep specified ones, add new ones (deduplicated)
    const keptImages = (oldItem.images || []).filter((img) =>
      imagesToKeep.includes(img.publicId)
    );
    finalImages = deduplicateImages(keptImages, uploadedImages);

    // Images to delete (only after DB update succeeds)
    imagesToDelete = (oldItem.images || []).filter(
      (img) => !imagesToKeep.includes(img.publicId)
    );

    // Update item (remove __v from update data, it's handled by MongoDB)
    const { __v, ...updateDataWithoutVersion } = data;
    const updateData: any = {
      ...updateDataWithoutVersion,
      images: finalImages,
    };
    if (data.categoryId) {
      updateData.categoryId = new Types.ObjectId(data.categoryId);
    }

    const updated = await Item.findOneAndUpdate(
      { _id: id, isDeleted: false, __v: oldItem.__v },
      updateData,
      { new: true, runValidators: true, session: dbSession }
    ).populate("category");

    if (!updated) {
      throw {
        status: 409,
        message:
          "Item has been modified by another user. Please refresh and try again.",
      };
    }

    if (!session) {
      await dbSession.commitTransaction();
    }

    // Delete old images only after successful DB update
    if (imagesToDelete.length > 0) {
      await Promise.all(
        imagesToDelete.map((img) =>
          deleteImage(img.publicId).catch((err) =>
            console.error(`Failed to delete image ${img.publicId}:`, err)
          )
        )
      );
    }

    return updated;
  } catch (error: any) {
    if (!session) {
      await dbSession.abortTransaction();
    }
    // Clean up uploaded images on error
    if (uploadedImages.length > 0) {
      await Promise.all(
        uploadedImages.map((img) =>
          deleteImage(img.publicId).catch((err) =>
            console.error(`Failed to cleanup image ${img.publicId}:`, err)
          )
        )
      );
    }
    throw error;
  } finally {
    if (!session) {
      dbSession.endSession();
    }
  }
};

export const updateStock = async (
  id: string,
  data: UpdateStockInput,
  session?: ClientSession
): Promise<ItemDoc | null> => {
  const item = await Item.findById(id).session(session || null);
  if (!item || item.isDeleted) {
    throw { status: 404, message: "Item not found" };
  }

  if (item.productType !== "inventory") {
    throw {
      status: 400,
      message: "Stock can only be updated for inventory items",
    };
  }

  let newStock: number;
  const operation = data.operation || "set";

  switch (operation) {
    case "set":
      newStock = data.stock;
      break;
    case "increment":
      newStock = (item.stock || 0) + data.stock;
      break;
    case "decrement":
      newStock = (item.stock || 0) - data.stock;
      break;
    default:
      throw {
        status: 400,
        message: "Invalid operation. Use 'set', 'increment', or 'decrement'",
      };
  }

  if (newStock < 0) {
    throw { status: 400, message: "Stock cannot be negative" };
  }

  const updated = await Item.findByIdAndUpdate(
    id,
    { stock: newStock },
    { new: true, runValidators: true, session: session || undefined }
  ).populate("categoryId", "name type");

  return updated;
};

export const deleteItem = async (id: string): Promise<ItemDoc | null> => {
  const item = await Item.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date(), isAvailable: false },
    { new: true, runValidators: true }
  ).populate("categoryId", "name type");

  return item;
};

export const restoreItem = async (id: string): Promise<ItemDoc | null> => {
  const item = await Item.findByIdAndUpdate(
    id,
    { isDeleted: false, deletedAt: null, isAvailable: true },
    { new: true, runValidators: true }
  ).populate("categoryId", "name type");

  return item;
};

export const permanentDeleteItem = async (id: string): Promise<void> => {
  const item = await Item.findById(id);
  if (!item) {
    throw { status: 404, message: "Item not found" };
  }

  // Delete images first
  if (item.images?.length) {
    await Promise.all(
      item.images.map((img) =>
        deleteImage(img.publicId).catch((err) =>
          console.error(`Failed to delete image ${img.publicId}:`, err)
        )
      )
    );
  }

  await Item.findByIdAndDelete(id);
};

export const getDeletedItems = async (): Promise<any[]> => {
  return await Item.find({ isDeleted: true })
    .populate("categoryId", "name type")
    .sort({ deletedAt: -1 })
    .lean();
};

export const getUnavailableItems = async (): Promise<any[]> => {
  return await Item.find({
    isAvailable: false,
    isDeleted: false,
  })
    .populate("categoryId", "name type")
    .sort({ name: 1 })
    .lean();
};

export const updateAvailability = async (
  id: string,
  isAvailable: boolean
): Promise<ItemDoc | null> => {
  return await Item.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isAvailable },
    { new: true, runValidators: true }
  ).populate("categoryId", "name type");
};
