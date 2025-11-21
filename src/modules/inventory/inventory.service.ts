import { Types } from "mongoose";
import { Inventory, InventoryDoc } from "./inventory.model";

export interface CreateInventoryInput {
  name: string;
  itemCode: string;
  description?: string;
  categoryId?: string;
  quantity: number;
  unit: string;
  minThreshold?: number;
}

export interface UpdateInventoryInput {
  name?: string;
  itemCode?: string;
  description?: string;
  categoryId?: string;
  quantity?: number;
  minThreshold?: number;
}

export interface PurchaseInput {
  quantity: number;
  cost: number;
  purchaseDate?: Date;
}

export interface ListInventoryFilters {
  lowStock?: boolean;
}

export const listInventory = async (filters: ListInventoryFilters = {}) => {
  const query: any = {};

  if (filters.lowStock) {
    // Find items where quantity < minThreshold
    const lowStockItems = await Inventory.find({
      $expr: { $lt: ["$quantity", { $ifNull: ["$minThreshold", 0] }] },
    })
      .populate("categoryId", "name")
      .sort({ quantity: 1 })
      .lean();

    return lowStockItems;
  }

  const items = await Inventory.find(query)
    .populate("categoryId", "name type")
    .sort({ createdAt: -1 })
    .lean();

  return items;
};

export const getInventoryById = async (
  id: string
): Promise<InventoryDoc | null> => {
  const inventory = await Inventory.findById(id)
    .populate("categoryId", "name type")
    .lean();

  return inventory as any;
};

export const createInventory = async (
  data: CreateInventoryInput
): Promise<InventoryDoc> => {
  // Normalize itemCode
  const itemCode = data.itemCode.trim().toUpperCase();

  // Check if inventory with this itemCode already exists
  const existing = await Inventory.findOne({ itemCode });
  if (existing) {
    throw {
      status: 409,
      message: "Inventory record with this item code already exists",
    };
  }

  // Validate quantity
  if (data.quantity < 0) {
    throw { status: 400, message: "Quantity cannot be negative" };
  }

  // Validate minThreshold
  if (data.minThreshold !== undefined && data.minThreshold < 0) {
    throw { status: 400, message: "Min threshold cannot be negative" };
  }

  // Validate categoryId if provided
  if (data.categoryId && !Types.ObjectId.isValid(data.categoryId)) {
    throw { status: 400, message: "Invalid category ID" };
  }

  const inventory = await Inventory.create({
    name: data.name.trim(),
    itemCode,
    description: data.description?.trim(),
    categoryId: data.categoryId
      ? (new Types.ObjectId(data.categoryId) as any)
      : undefined,
    quantity: data.quantity,
    unit: data.unit,
    minThreshold: data.minThreshold,
  });

  await inventory.populate("categoryId", "name type");

  return inventory;
};

export const updateInventory = async (
  id: string,
  data: UpdateInventoryInput
): Promise<InventoryDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw { status: 400, message: "Invalid inventory ID" };
  }

  const inventory = await Inventory.findById(id);

  if (!inventory) {
    throw { status: 404, message: "Inventory record not found" };
  }

  // Update name if provided
  if (data.name !== undefined) {
    inventory.name = data.name.trim();
  }

  // Update itemCode if provided (check for duplicates)
  if (data.itemCode !== undefined) {
    const itemCode = data.itemCode.trim().toUpperCase();
    if (itemCode !== inventory.itemCode) {
      const existing = await Inventory.findOne({
        itemCode,
        _id: { $ne: id },
      });
      if (existing) {
        throw {
          status: 409,
          message: "Inventory record with this item code already exists",
        };
      }
      inventory.itemCode = itemCode;
    }
  }

  // Update description if provided
  if (data.description !== undefined) {
    inventory.description = data.description.trim();
  }

  // Update categoryId if provided
  if (data.categoryId !== undefined) {
    if (data.categoryId && !Types.ObjectId.isValid(data.categoryId)) {
      throw { status: 400, message: "Invalid category ID" };
    }
    inventory.categoryId = data.categoryId
      ? (new Types.ObjectId(data.categoryId) as any)
      : undefined;
  }

  // Update quantity if provided
  if (data.quantity !== undefined) {
    if (data.quantity < 0) {
      throw { status: 400, message: "Quantity cannot be negative" };
    }
    inventory.quantity = data.quantity;
  }

  // Update minThreshold if provided
  if (data.minThreshold !== undefined) {
    if (data.minThreshold < 0) {
      throw { status: 400, message: "Min threshold cannot be negative" };
    }
    inventory.minThreshold = data.minThreshold;
  }

  await inventory.save();

  await inventory.populate("categoryId", "name type");

  return inventory;
};

export const recordPurchase = async (
  id: string,
  data: PurchaseInput,
  purchasedBy: string
): Promise<InventoryDoc | null> => {
  const inventory = await Inventory.findById(id);

  if (!inventory) {
    throw { status: 404, message: "Inventory record not found" };
  }

  if (data.quantity <= 0) {
    throw { status: 400, message: "Purchase quantity must be greater than 0" };
  }

  if (data.cost < 0) {
    throw { status: 400, message: "Purchase cost cannot be negative" };
  }

  // Update quantity
  inventory.quantity += data.quantity;
  inventory.lastPurchaseDate = data.purchaseDate || new Date();

  // Add to purchase history
  inventory.purchaseHistory.push({
    quantity: data.quantity,
    purchaseDate: data.purchaseDate || new Date(),
    cost: data.cost,
    purchasedBy: new Types.ObjectId(purchasedBy),
  });

  await inventory.save();

  await inventory.populate("categoryId", "name type");
  await inventory.populate("purchaseHistory.purchasedBy", "name email");

  return inventory;
};

export const getLowStockItems = async () => {
  const lowStockItems = await Inventory.find({
    $expr: { $lt: ["$quantity", { $ifNull: ["$minThreshold", 0] }] },
  })
    .populate("categoryId", "name type")
    .sort({ quantity: 1 })
    .lean();

  return lowStockItems;
};

export const getPurchaseHistory = async (id: string) => {
  const inventory = await Inventory.findById(id)
    .populate("purchaseHistory.purchasedBy", "name email")
    .select("purchaseHistory")
    .lean();

  if (!inventory) {
    throw { status: 404, message: "Inventory record not found" };
  }

  return inventory.purchaseHistory || [];
};
