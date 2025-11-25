import { Types } from "mongoose";
import { Inventory, InventoryDoc } from "./inventory.model";

export interface ListInventoryFilters {
  lowStock?: boolean;
  categoryId?: string;
}

export interface CreateInventoryInput {
  name: string;
  description?: string;
  categoryId?: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface UpdateInventoryInput {
  name?: string;
  description?: string;
  categoryId?: string;
  quantity?: number;
  price?: number;
}

/* ---------------------- COMMON UTILS ---------------------- */

const validateObjectId = (id: string, message = "Invalid ID") => {
  if (id && !Types.ObjectId.isValid(id)) {
    throw { status: 400, message };
  }
};

/* ---------------------- LIST ---------------------- */

export const listInventory = async (filters: ListInventoryFilters = {}) => {
  const query: any = {};

  // Optional category filter
  if (filters.categoryId) {
    validateObjectId(filters.categoryId, "Invalid category ID");
    query.categoryId = new Types.ObjectId(filters.categoryId);
  }

  // Low stock filter (quantity <= 0)
  if (filters.lowStock) {
    query.quantity = { $lte: 0 };
  }

  return Inventory.find(query)
    .populate("categoryId", "name type")
    .sort(filters.lowStock ? { quantity: 1 } : { createdAt: -1 })
    .lean();
};

/* ---------------------- GET BY ID ---------------------- */

export const getInventoryById = async (
  id: string
): Promise<InventoryDoc | null> => {
  validateObjectId(id, "Invalid inventory ID");

  // Return document so virtuals work
  return Inventory.findById(id).populate("categoryId", "name type");
};

/* ---------------------- CREATE ---------------------- */

export const createInventory = async (
  data: CreateInventoryInput
): Promise<InventoryDoc> => {
  if (data.quantity < 0)
    throw { status: 400, message: "Quantity cannot be negative" };

  if (data.price < 0)
    throw { status: 400, message: "Price cannot be negative" };

  validateObjectId(data.categoryId || "", "Invalid category ID");

  const inventory = await Inventory.create({
    name: data.name.trim(),
    description: data.description?.trim(),
    categoryId: data.categoryId || undefined,
    quantity: data.quantity,
    unit: data.unit,
    price: data.price,
  });

  await inventory.populate("categoryId", "name type");

  return inventory;
};

/* ---------------------- UPDATE ---------------------- */

export const updateInventory = async (
  id: string,
  data: UpdateInventoryInput
): Promise<InventoryDoc | null> => {
  validateObjectId(id, "Invalid inventory ID");

  const inventory = await Inventory.findById(id);
  if (!inventory) return null;

  if (data.name !== undefined) inventory.name = data.name.trim();
  if (data.description !== undefined)
    inventory.description = data.description?.trim();

  if (data.categoryId !== undefined) {
    validateObjectId(data.categoryId, "Invalid category ID");
    inventory.categoryId = data.categoryId || undefined;
  }

  if (data.quantity !== undefined) {
    if (data.quantity < 0)
      throw { status: 400, message: "Quantity cannot be negative" };
    inventory.quantity = data.quantity;
  }

  if (data.price !== undefined) {
    if (data.price < 0)
      throw { status: 400, message: "Price cannot be negative" };
    inventory.price = data.price;
  }

  await inventory.save();
  await inventory.populate("categoryId", "name type");

  return inventory;
};

/* ---------------------- LOW STOCK ---------------------- */

export const getLowStockItems = async () => {
  return Inventory.find({
    quantity: { $lte: 0 },
  })
    .populate("categoryId", "name type")
    .sort({ quantity: 1 })
    .lean();
};
