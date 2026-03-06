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
  if (!id) {
    throw { status: 400, message: `${message}: ID is required` };
  }
  if (!Types.ObjectId.isValid(id)) {
    throw { status: 400, message: `${message}: ${id} is not a valid ObjectId` };
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
    approvalStatus: "pendingapproval", // New inventory requires approval
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

  // Updates require re-approval
  inventory.approvalStatus = "pendingapproval";

  await inventory.save();

  return inventory;
};

/* ---------------------- DELETE ---------------------- */

export const deleteInventory = async (
  id: string
): Promise<InventoryDoc | null> => {
  validateObjectId(id, "Invalid inventory ID");

  const inventory = await Inventory.findByIdAndDelete(id);
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

/* ---------------------- APPROVAL ---------------------- */

/**
 * Lists inventory items pending approval
 * @returns Array of inventory items with approvalStatus "pendingapproval"
 */
export const listPendingApprovals = async () => {
  const items = await Inventory.find({
    approvalStatus: "pendingapproval",
  })
    .populate("approvedBy")
    .sort({ createdAt: -1 })
    .lean();

  // Transform _id to id for lean documents
  return items.map((item: any) => ({
    ...item,
    id: item._id?.toString() || item.id,
  }));
};

/**
 * Approves an inventory item
 * @param id - Inventory ID
 * @param approvedBy - User ID who approved
 * @returns Updated inventory item
 */
export const approveInventory = async (
  id: string,
  approvedBy: string
): Promise<InventoryDoc | null> => {
  validateObjectId(id, "Invalid inventory ID");
  validateObjectId(approvedBy, "Invalid user ID");

  const inventory = await Inventory.findByIdAndUpdate(
    id,
    {
      approvalStatus: "approved",
      approvedBy: new Types.ObjectId(approvedBy),
      approvedAt: new Date(),
    },
    { new: true, runValidators: true }
  );

  if (!inventory) {
    throw { status: 404, message: "Inventory item not found" };
  }

  return inventory;
};

/**
 * Rejects an inventory item
 * @param id - Inventory ID
 * @param approvedBy - User ID who rejected
 * @returns Updated inventory item
 */
export const rejectInventory = async (
  id: string,
  approvedBy: string
): Promise<InventoryDoc | null> => {
  validateObjectId(id, "Invalid inventory ID");
  validateObjectId(approvedBy, "Invalid user ID");

  const inventory = await Inventory.findByIdAndUpdate(
    id,
    {
      approvalStatus: "rejected",
      approvedBy: new Types.ObjectId(approvedBy),
      approvedAt: new Date(),
    },
    { new: true, runValidators: true }
  );

  if (!inventory) {
    throw { status: 404, message: "Inventory item not found" };
  }

  return inventory;
};
