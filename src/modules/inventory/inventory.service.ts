import { Types } from "mongoose";
import { Inventory, InventoryDoc } from "./inventory.model";

export interface ListInventoryFilters {
  lowStock?: boolean;
}

export interface CreateInventoryInput {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface UpdateInventoryInput {
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
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

  // Low stock filter (quantity <= 0)
  if (filters.lowStock) {
    query.quantity = { $lte: 0 };
  }

  return Inventory.find(query)
    .sort(filters.lowStock ? { quantity: 1 } : { createdAt: -1 })
    .lean();
};

/* ---------------------- GET BY ID ---------------------- */

export const getInventoryById = async (
  id: string
): Promise<InventoryDoc | null> => {
  validateObjectId(id, "Invalid inventory ID");

  // Return document so virtuals work
  return Inventory.findById(id);
};

/* ---------------------- CREATE ---------------------- */

export const createInventory = async (
  data: CreateInventoryInput
): Promise<InventoryDoc> => {
  if (data.quantity < 0)
    throw { status: 400, message: "Quantity cannot be negative" };

  if (data.price < 0)
    throw { status: 400, message: "Price cannot be negative" };

  const inventory = await Inventory.create({
    name: data.name.trim(),
    description: data.description?.trim(),
    quantity: data.quantity,
    unit: data.unit,
    price: data.price,
  });

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

  if (data.quantity !== undefined) {
    if (data.quantity < 0)
      throw { status: 400, message: "Quantity cannot be negative" };
    inventory.quantity = data.quantity;
  }

  if (data.unit !== undefined) {
    inventory.unit = data.unit.trim();
  }

  if (data.price !== undefined) {
    if (data.price < 0)
      throw { status: 400, message: "Price cannot be negative" };
    inventory.price = data.price;
  }

  await inventory.save();

  return inventory;
};

/* ---------------------- LOW STOCK ---------------------- */

export const getLowStockItems = async () => {
  return Inventory.find({
    quantity: { $lte: 0 },
  })
    .sort({ quantity: 1 })
    .lean();
};
