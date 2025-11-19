import { Types } from "mongoose";
import { Inventory, InventoryDoc } from "./inventory.model";
import { Item } from "../items/item.model";

export interface CreateInventoryInput {
  productId: string;
  quantity: number;
  unit: string;
  minThreshold?: number;
}

export interface UpdateInventoryInput {
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
      .populate("productId", "name itemCode productType")
      .sort({ quantity: 1 })
      .lean();

    return lowStockItems;
  }

  const items = await Inventory.find(query)
    .populate("productId", "name itemCode productType stock unit")
    .sort({ createdAt: -1 })
    .lean();

  return items;
};

export const getInventoryById = async (
  id: string
): Promise<InventoryDoc | null> => {
  const inventory = await Inventory.findById(id)
    .populate("productId", "name itemCode productType stock unit")
    .lean();

  return inventory as any;
};

export const createInventory = async (
  data: CreateInventoryInput
): Promise<InventoryDoc> => {
  // Validate product exists and has productType: "inventory"
  const product = await Item.findById(data.productId);
  if (!product) {
    throw { status: 404, message: "Product not found" };
  }

  if (product.productType !== "inventory") {
    throw {
      status: 400,
      message: "Product must have productType 'inventory'",
    };
  }

  // Check if inventory already exists for this product
  const existing = await Inventory.findOne({ productId: data.productId });
  if (existing) {
    throw {
      status: 409,
      message: "Inventory record already exists for this product",
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

  const inventory = await Inventory.create({
    productId: new Types.ObjectId(data.productId),
    quantity: data.quantity,
    unit: data.unit,
    minThreshold: data.minThreshold,
  });

  // Update product stock field
  await Item.findByIdAndUpdate(data.productId, {
    stock: data.quantity,
    unit: data.unit,
  });

  await inventory.populate("productId", "name itemCode productType stock unit");

  return inventory;
};

export const updateInventory = async (
  id: string,
  data: UpdateInventoryInput
): Promise<InventoryDoc | null> => {
  const inventory = await Inventory.findById(id);

  if (!inventory) {
    throw { status: 404, message: "Inventory record not found" };
  }

  if (data.quantity !== undefined) {
    if (data.quantity < 0) {
      throw { status: 400, message: "Quantity cannot be negative" };
    }
    inventory.quantity = data.quantity;

    // Update product stock field
    await Item.findByIdAndUpdate(inventory.productId, {
      stock: data.quantity,
    });
  }

  if (data.minThreshold !== undefined) {
    if (data.minThreshold < 0) {
      throw { status: 400, message: "Min threshold cannot be negative" };
    }
    inventory.minThreshold = data.minThreshold;
  }

  await inventory.save();

  await inventory.populate("productId", "name itemCode productType stock unit");

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

  // Update product stock field
  await Item.findByIdAndUpdate(inventory.productId, {
    stock: inventory.quantity,
  });

  await inventory.populate("productId", "name itemCode productType stock unit");
  await inventory.populate("purchaseHistory.purchasedBy", "name email");

  return inventory;
};

export const getLowStockItems = async () => {
  const lowStockItems = await Inventory.find({
    $expr: { $lt: ["$quantity", { $ifNull: ["$minThreshold", 0] }] },
  })
    .populate("productId", "name itemCode productType")
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
