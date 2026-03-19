import mongoose, { Types } from "mongoose";
import { formatMergedReceipt, formatReceipt } from "../../common/utils/receiptFormatter";
import { deleteImage, uploadImage } from "../../config/cloudinary";
import {
  notifyCashiersNewOrder,
  notifyCustomerOrderUpdated,
} from "../../sockets/events";
import { User } from "../auth/user.model";
import { Inventory } from "../inventory/inventory.model";
import { Order, OrderDoc, OrderStatus, fixOrderCodeIndex } from "./order.model";

// Helper function to populate user tracking fields
const populateUserTrackingFields = async (order: OrderDoc): Promise<void> => {
  await order.populate("cancelledBy", "name email phone");
  await order.populate("transferredToOwnerBy", "name email phone");
  await order.populate("confirmedBy", "name email phone");
  await order.populate("disputedBy", "name email phone");
};

// Generate order number with date prefix and sequential number
const generateOrderNumber = async (): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `ORD-${dateStr}-`;

  // Find the last order number for today
  const lastOrder = await Order.findOne({
    orderNumber: { $regex: `^${prefix}` },
  })
    .sort({ orderNumber: -1 })
    .select("orderNumber")
    .lean();

  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const lastSeq = parseInt(lastOrder.orderNumber.split("-").pop() || "0");
    sequence = lastSeq + 1;
  }

  // Format sequence as 4-digit number (0001, 0002, etc.)
  const seqStr = sequence.toString().padStart(4, "0");
  return `${prefix}${seqStr}`;
};

export type CreateOrderInput = {
  tableNumber?: string; // Optional table number
  items: {
    itemId: string;
    qty: number;
    nameSnapshot: string;
    priceSnapshot: number;
  }[];
  note?: string;
  waiterId: string; // Required - order must be assigned to a waiter
  cashierId?: string; // Optional, will be auto-assigned from req.user if cashier
  clientId?: string; // For offline sync idempotency
  markAsPaidToCashier?: boolean; // Optional - if true, order starts with PAID_TO_CASHIER status
  markAsTransferredToOwner?: boolean; // Optional - if true, order starts with TRANSFERRED_TO_OWNER status
  paymentMethod?: "cash" | "mobile_banking"; // Required when markAsTransferredToOwner is true
};

export const createOrder = async (
  payload: CreateOrderInput,
  cashierId?: string
): Promise<{ order: OrderDoc; receiptText: string }> => {
  // Fix old orderCode index if it exists (one-time fix)
  await fixOrderCodeIndex().catch(() => {
    // Ignore errors - index fix is not critical for order creation
  });

  // Check for idempotency if clientId provided
  if (payload.clientId) {
    const existing = await Order.findOne({ clientId: payload.clientId });
    if (existing) {
      await existing.populate({
        path: "items.itemId",
        select: "name description price image isAvailable",
        populate: { path: "category", select: "name", strictPopulate: false },
      });
      await existing.populate("waiterId", "name email phone");
      await existing.populate("cashierId", "name email phone");
      await populateUserTrackingFields(existing);
      const receiptText = formatReceipt(existing);
      return { order: existing, receiptText };
    }
  }

  // Validate waiterId (required)
  if (!payload.waiterId) {
    throw {
      status: 400,
      message: "Waiter ID is required",
    };
  }

  const waiter = await User.findById(payload.waiterId);
  if (!waiter || waiter.role !== "waiter") {
    throw {
      status: 400,
      message: "Invalid waiter ID or user is not a waiter",
    };
  }

  // Validate inventory quantities before order creation
  const inventoryItemsToUpdate: Array<{ inventory: any; qty: number }> = [];

  for (const item of payload.items) {
    // Check if this itemId exists in Inventory model
    const inventory = await Inventory.findById(item.itemId);
    if (inventory) {
      // This is an inventory item - validate quantity
      if (inventory.quantity < item.qty) {
        throw {
          status: 400,
          message: `Insufficient quantity for ${inventory.name}. Available: ${inventory.quantity}, Requested: ${item.qty}`,
        };
      }
      // Store for later decrement
      inventoryItemsToUpdate.push({ inventory, qty: item.qty });
    }
  }

  const subtotal = payload.items.reduce(
    (s, it) => s + it.priceSnapshot * it.qty,
    0
  );

  // Get inventory item IDs for model mapping
  const inventoryIds = new Set(
    inventoryItemsToUpdate.map((it) => it.inventory._id.toString())
  );

  const orderNumber = await generateOrderNumber();

  const session = await mongoose.startSession();
  session.startTransaction();

  let order: OrderDoc;

  const now = new Date();
  let initialStatus: OrderStatus = "OPEN";
  let paymentReceivedAt: Date | undefined;
  let paymentDeliveredAt: Date | undefined;
  let orderPaymentMethod: "cash" | "mobile_banking" | undefined;
  let transferredToOwnerBy: Types.ObjectId | undefined;

  if (payload.markAsTransferredToOwner) {
    initialStatus = "TRANSFERRED_TO_OWNER";
    paymentReceivedAt = now;
    paymentDeliveredAt = now;
    orderPaymentMethod = payload.paymentMethod || "cash";
    transferredToOwnerBy = cashierId ? new Types.ObjectId(cashierId) : undefined;
  } else if (payload.markAsPaidToCashier) {
    initialStatus = "PAID_TO_CASHIER";
    paymentReceivedAt = now;
    orderPaymentMethod = payload.paymentMethod || "cash";
  }

  try {
    const [created] = await Order.create(
      [
        {
          orderNumber,
          tableNumber: payload.tableNumber,
          items: payload.items.map((i) => ({
            itemId: new Types.ObjectId(i.itemId) as any,
            itemModel: inventoryIds.has(i.itemId) ? "Inventory" : "Item",
            qty: i.qty,
            nameSnapshot: i.nameSnapshot,
            priceSnapshot: i.priceSnapshot,
          })),
          note: payload.note,
          totalAmount: subtotal,
          status: initialStatus,
          placedAt: now,
          paymentReceivedAt,
          paymentDeliveredAt,
          paymentMethod: orderPaymentMethod,
          transferredToOwnerBy,
          waiterId: new Types.ObjectId(payload.waiterId),
          cashierId: cashierId ? new Types.ObjectId(cashierId) : undefined,
          clientId: payload.clientId,
        },
      ],
      { session },
    );
    order = created;

    // Atomic inventory decrement - prevents overselling under concurrent requests
    for (const { inventory, qty } of inventoryItemsToUpdate) {
      const result = await Inventory.findOneAndUpdate(
        { _id: inventory._id, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { new: true, session },
      );
      if (!result) {
        throw {
          status: 400,
          message: `Insufficient quantity for ${inventory.name}. Available: ${inventory.quantity}, Requested: ${qty}`,
        };
      }
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  // order from create above
  // Populate item details with categories before returning
  await order.populate({
    path: "items.itemId",
    select: "name description price image isAvailable",
    populate: { path: "category", select: "name", strictPopulate: false },
  });
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");
  await populateUserTrackingFields(order);

  // Broadcast the new order
  notifyCashiersNewOrder(order);

  // Automatically format receipt and return it
  const receiptText = formatReceipt(order);

  return { order, receiptText };
};

export interface ListOrdersFilters {
  status?: OrderStatus;
  waiterId?: string;
  cashierId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string; // Search by orderNumber, tableNumber, waiter name, cashier name
  tableNumber?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export const listOrders = async (
  filters: ListOrdersFilters = {}
): Promise<PaginatedResponse<OrderDoc>> => {
  const query: any = {};
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const skip = (page - 1) * limit;

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.waiterId) {
    query.waiterId = new Types.ObjectId(filters.waiterId);
  }

  if (filters.cashierId) {
    query.cashierId = new Types.ObjectId(filters.cashierId);
  }

  if (filters.tableNumber) {
    query.tableNumber = { $regex: filters.tableNumber, $options: "i" };
  }

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // Handle search at database level
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    const searchRegex = { $regex: searchTerm, $options: "i" };

    // To search in populated fields like waiterId.name, we would normally use aggregation.
    // For simplicity with the existing structure, we'll keep the core fields database-level
    // and consider if we need more complex aggregation later.
    query.$or = [
      { orderNumber: searchRegex },
      { tableNumber: searchRegex },
      { note: searchRegex },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "items.itemId",
        select: "name description price image isAvailable",
        populate: { path: "category", select: "name", strictPopulate: false },
      })
      .populate("waiterId", "name email phone")
      .populate("cashierId", "name email phone")
      .populate("cancelledBy", "name email phone")
      .populate("transferredToOwnerBy", "name email phone")
      .populate("confirmedBy", "name email phone")
      .populate("disputedBy", "name email phone"),
    Order.countDocuments(query),
  ]);

  return {
    data: orders,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
};

export const getOwnerOrders = async (
  filters: ListOrdersFilters = {}
): Promise<PaginatedResponse<OrderDoc>> => {
  return listOrders(filters);
};

export const getOrder = async (id: string): Promise<OrderDoc | null> => {
  const order = await Order.findById(id)
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name", strictPopulate: false },
    })
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone")
    .populate("cancelledBy", "name email phone")
    .populate("transferredToOwnerBy", "name email phone")
    .populate("confirmedBy", "name email phone")
    .populate("disputedBy", "name email phone");

  return order;
};

// Valid status transitions
const validStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  OPEN: ["VOIDED", "PAID_TO_CASHIER", "TRANSFERRED_TO_OWNER"],
  VOIDED: [], // Terminal state - cannot be changed
  PAID_TO_CASHIER: ["TRANSFERRED_TO_OWNER", "DISPUTED"],
  TRANSFERRED_TO_OWNER: ["OWNER_CONFIRMED"], // Owner can confirm the transferred cash
  DISPUTED: ["PAID_TO_CASHIER", "TRANSFERRED_TO_OWNER"],
  OWNER_CONFIRMED: [], // Terminal state
};

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus,
  userId: string,
  paymentMethod?: "cash" | "mobile_banking",
  paymentProofImageFile?: Express.Multer.File,
  paymentBankName?: string
): Promise<{ order: OrderDoc; receiptText?: string } | null> => {
  const order = await Order.findById(id);

  if (!order) {
    throw { status: 404, message: "Order not found" };
  }

  // Validate status transition
  const allowedTransitions = validStatusTransitions[order.status];
  if (!allowedTransitions.includes(status)) {
    throw {
      status: 400,
      message: `Invalid status transition from ${order.status} to ${status}`,
    };
  }

  // Validate user permissions
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 401, message: "User not found" };
  }

  // Waiter has no status update permissions (manual cash collection only)
  if (user.role === "waiter") {
    throw {
      status: 403,
      message: "Waiters do not have permission to update order status",
    };
  }

  // Role-based permission validation
  if (user.role === "cashier") {
    // Cashier can: OPEN → VOIDED, PAID_TO_CASHIER, or TRANSFERRED_TO_OWNER
    if (
      order.status === "OPEN" &&
      status !== "VOIDED" &&
      status !== "PAID_TO_CASHIER" &&
      status !== "TRANSFERRED_TO_OWNER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only void, mark as paid to waiter, or mark as paid to cashier from OPEN status",
      };
    }
    // Cashier can: PAID_TO_CASHIER → TRANSFERRED_TO_OWNER
    if (
      order.status === "PAID_TO_CASHIER" &&
      status !== "TRANSFERRED_TO_OWNER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only mark as transferred to owner from PAID_TO_CASHIER status",
      };
    }
    // Cashier can: DISPUTED → PAID_TO_CASHIER or TRANSFERRED_TO_OWNER (resolve dispute)
    if (
      order.status === "DISPUTED" &&
      status !== "PAID_TO_CASHIER" &&
      status !== "TRANSFERRED_TO_OWNER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only resolve dispute by marking as paid to cashier or transferred to owner",
      };
    }
    // Cashier cannot perform other transitions
    if (!["OPEN", "PAID_TO_CASHIER", "DISPUTED"].includes(order.status)) {
      throw {
        status: 403,
        message: "Cashier does not have permission for this status transition",
      };
    }
  }

  if (user.role === "owner") {
    // Owner can only change TRANSFERRED_TO_OWNER → OWNER_CONFIRMED
    if (order.status !== "TRANSFERRED_TO_OWNER") {
      throw {
        status: 403,
        message:
          "Owner can only confirm orders that have been transferred (TRANSFERRED_TO_OWNER status)",
      };
    }
    if (status !== "OWNER_CONFIRMED") {
      throw {
        status: 403,
        message:
          "Owner can only change status from TRANSFERRED_TO_OWNER to OWNER_CONFIRMED",
      };
    }
  }

  // Set status, corresponding timestamp, and user tracking
  order.status = status;
  const now = new Date();
  const userIdObjectId = new Types.ObjectId(userId);

  // Handle payment method and proof image for PAID_TO_CASHIER status
  if (status === "PAID_TO_CASHIER") {
    order.paymentReceivedAt = now;
    if (user.role === "cashier" && !order.cashierId) {
      order.cashierId = userIdObjectId as any;
    }

    // Set payment method (default to cash if not provided)
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    } else {
      order.paymentMethod = "cash";
    }

    // Handle payment proof image upload for mobile banking
    if (paymentMethod === "mobile_banking" && paymentProofImageFile) {
      try {
        // Delete old payment proof image if exists
        if (order.paymentProofImage?.publicId) {
          await deleteImage(order.paymentProofImage.publicId).catch((err) =>
            console.error(
              `Failed to delete old payment proof image: ${err.message}`
            )
          );
        }

        // Upload new payment proof image
        const uploadResult = await uploadImage(
          paymentProofImageFile.buffer,
          "payment-proofs"
        );
        order.paymentProofImage = {
          url: uploadResult.url,
          publicId: uploadResult.public_id,
        };
      } catch (error: any) {
        throw {
          status: 500,
          message: "Failed to upload payment proof image",
          details: error.message,
        };
      }
    }

    // Set payment bank name if provided
    if (paymentBankName) {
      order.paymentBankName = paymentBankName;
    }

    if (paymentMethod === "cash" && order.paymentProofImage) {
      // Clear payment proof image for cash payments
      if (order.paymentProofImage.publicId) {
        await deleteImage(order.paymentProofImage.publicId).catch((err) =>
          console.error(`Failed to delete payment proof image: ${err.message}`)
        );
      }
      order.paymentProofImage = undefined;
    }
  }

  if (status === "VOIDED") {
    order.cancelledAt = now;
    order.cancelledBy = userIdObjectId as any;
  } else if (status === "TRANSFERRED_TO_OWNER") {
    order.paymentDeliveredAt = now;
    order.transferredToOwnerBy = userIdObjectId as any;
    if (user.role === "cashier" && !order.cashierId) {
      order.cashierId = userIdObjectId as any;
    }
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    } else if (!order.paymentMethod) {
      order.paymentMethod = "cash";
    }
  } else if (status === "OWNER_CONFIRMED") {
    order.completedAt = now;
    order.confirmedBy = userIdObjectId as any;
  } else if (status === "DISPUTED") {
    order.disputedBy = userIdObjectId as any;
    // DISPUTED status change doesn't set a timestamp
  }

  await order.save();

  await order.populate(
    "items.itemId",
    "name description price images isAvailable ingredients"
  );
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");
  await populateUserTrackingFields(order);

  // Broadcast status change
  notifyCustomerOrderUpdated(order, { updatedFields: { status } });

  // Automatically format receipt if status changed to PAID_TO_CASHIER or TRANSFERRED_TO_OWNER
  let receiptText: string | undefined;
  if (status === "PAID_TO_CASHIER" || status === "TRANSFERRED_TO_OWNER") {
    receiptText = formatReceipt(order);
  }

  return { order, receiptText };
};

/**
 * Bulk update order statuses
 * Only updates orders that have the same current status
 */
export const bulkUpdateOrderStatus = async (
  orderIds: string[],
  newStatus: OrderStatus,
  userId: string,
  paymentMethod?: "cash" | "mobile_banking"
): Promise<{
  updated: Array<OrderDoc & { receiptText?: string }>;
  failed: Array<{ id: string; reason: string }>;
  mergedReceiptText?: string;
}> => {
  if (!orderIds || orderIds.length === 0) {
    throw { status: 400, message: "Order IDs are required" };
  }

  // Validate user permissions
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 401, message: "User not found" };
  }

  // Waiter has no status update permissions
  if (user.role === "waiter") {
    throw {
      status: 403,
      message: "Waiters do not have permission to update order status",
    };
  }

  const updated: OrderDoc[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  // Get all orders first to check their current status
  const orders = await Order.find({
    _id: { $in: orderIds.map((id) => new Types.ObjectId(id)) },
  });

  if (orders.length === 0) {
    throw { status: 404, message: "No orders found" };
  }

  // Check if all orders have the same status
  const firstOrderStatus = orders[0].status;
  const allSameStatus = orders.every(
    (order) => order.status === firstOrderStatus
  );

  if (!allSameStatus) {
    throw {
      status: 400,
      message: "All selected orders must have the same status",
    };
  }

  // Validate status transition for the common status
  const allowedTransitions = validStatusTransitions[firstOrderStatus];
  if (!allowedTransitions.includes(newStatus)) {
    throw {
      status: 400,
      message: `Invalid status transition from ${firstOrderStatus} to ${newStatus}`,
    };
  }

  // Role-based permission validation for the transition
  if (user.role === "cashier") {
    // Cashier can: OPEN → VOIDED, PAID_TO_CASHIER, or TRANSFERRED_TO_OWNER
    if (
      firstOrderStatus === "OPEN" &&
      newStatus !== "VOIDED" &&
      newStatus !== "PAID_TO_CASHIER" &&
      newStatus !== "TRANSFERRED_TO_OWNER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only void, mark as paid to waiter, or mark as paid to cashier from OPEN status",
      };
    }
    // Cashier can: PAID_TO_CASHIER → TRANSFERRED_TO_OWNER
    if (
      firstOrderStatus === "PAID_TO_CASHIER" &&
      newStatus !== "TRANSFERRED_TO_OWNER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only mark as transferred to owner from PAID_TO_CASHIER status",
      };
    }
    // Cashier can: DISPUTED → PAID_TO_CASHIER or TRANSFERRED_TO_OWNER (resolve dispute)
    if (
      firstOrderStatus === "DISPUTED" &&
      newStatus !== "PAID_TO_CASHIER" &&
      newStatus !== "TRANSFERRED_TO_OWNER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only resolve dispute by marking as paid to cashier or transferred to owner",
      };
    }
    // Cashier cannot perform other transitions
    if (!["OPEN", "PAID_TO_CASHIER", "DISPUTED"].includes(firstOrderStatus)) {
      throw {
        status: 403,
        message: "Cashier does not have permission for this status transition",
      };
    }
  }

  if (user.role === "owner") {
    // Owner can only change TRANSFERRED_TO_OWNER → OWNER_CONFIRMED
    if (firstOrderStatus !== "TRANSFERRED_TO_OWNER") {
      throw {
        status: 403,
        message:
          "Owner can only confirm orders that have been transferred (TRANSFERRED_TO_OWNER status)",
      };
    }
    if (newStatus !== "OWNER_CONFIRMED") {
      throw {
        status: 403,
        message:
          "Owner can only change status from TRANSFERRED_TO_OWNER to OWNER_CONFIRMED",
      };
    }
  }

  // Update all orders
  const now = new Date();
  const userIdObjectId = new Types.ObjectId(userId);

  for (const order of orders) {
    try {
      // Double-check status hasn't changed (race condition protection)
      if (order.status !== firstOrderStatus) {
        failed.push({
          id: String(order._id),
          reason: `Order status changed from ${firstOrderStatus} to ${order.status}`,
        });
        continue;
      }

      // Set status, corresponding timestamp, and user tracking
      order.status = newStatus;

      if (newStatus === "VOIDED") {
        order.cancelledAt = now;
        order.cancelledBy = userIdObjectId as any;
      } else if (newStatus === "PAID_TO_CASHIER") {
        order.paymentReceivedAt = now;
        if (user.role === "cashier" && !order.cashierId) {
          order.cashierId = userIdObjectId as any;
        }
      } else if (newStatus === "TRANSFERRED_TO_OWNER") {
        order.paymentDeliveredAt = now;
        order.transferredToOwnerBy = userIdObjectId as any;
        if (user.role === "cashier" && !order.cashierId) {
          order.cashierId = userIdObjectId as any;
        }
        if (paymentMethod) {
          order.paymentMethod = paymentMethod;
        } else if (!order.paymentMethod) {
          order.paymentMethod = "cash";
        }
      } else if (newStatus === "OWNER_CONFIRMED") {
        order.completedAt = now;
        order.confirmedBy = userIdObjectId as any;
      } else if (newStatus === "DISPUTED") {
        order.disputedBy = userIdObjectId as any;
      }

      await order.save();

      // Populate fields
      await order.populate(
        "items.itemId",
        "name description price images isAvailable ingredients"
      );
      await order.populate("waiterId", "name email phone");
      await order.populate("cashierId", "name email phone");
      await populateUserTrackingFields(order);

      // Broadcast status change
      notifyCustomerOrderUpdated(order, {
        updatedFields: { status: newStatus },
      });

      // Generate receipt text if new status is PAID_TO_CASHIER or TRANSFERRED_TO_OWNER
      let receiptText: string | undefined;
      if (newStatus === "PAID_TO_CASHIER" || newStatus === "TRANSFERRED_TO_OWNER") {
        receiptText = formatReceipt(order);
      }

      // Add receiptText to the updated order object for the response
      const orderWithReceipt = order.toObject() as any;
      if (receiptText) {
        orderWithReceipt.receiptText = receiptText;
      }

      updated.push(orderWithReceipt);
    } catch (error: any) {
      failed.push({
        id: String(order._id),
        reason: error.message || "Failed to update order",
      });
    }
  }

  let mergedReceiptText: string | undefined;

  // Generate merged receipt if updating to PAID_TO_CASHIER and there's more than one successful update
  if (newStatus === "PAID_TO_CASHIER" && updated.length > 1) {
    mergedReceiptText = formatMergedReceipt(updated);
  }

  return { updated, failed, mergedReceiptText };
};

export interface UpdateOrderInput {
  notes?: string;
  items?: {
    itemId: string;
    qty: number;
    nameSnapshot: string;
    priceSnapshot: number;
  }[];
  tableNumber?: string;
}

export const updateOrder = async (
  id: string,
  data: UpdateOrderInput
): Promise<OrderDoc | null> => {
  const order = await Order.findById(id);

  if (!order) {
    throw { status: 404, message: "Order not found" };
  }

  // Only allow updates when order status is OPEN
  if (order.status !== "OPEN") {
    throw {
      status: 400,
      message: "Order can only be updated when status is OPEN",
    };
  }

  // Update table number if provided
  if (data.tableNumber !== undefined) {
    order.tableNumber = data.tableNumber;
  }

  // Update items if provided
  if (data.items) {
    const oldItems = order.items;
    const newItemsInput = data.items;

    // Track original quantities for inventory items in this order
    const oldInventoryQtys = new Map<string, number>();
    oldItems.forEach((item) => {
      if (item.itemModel === "Inventory") {
        const id = item.itemId.toString();
        oldInventoryQtys.set(id, (oldInventoryQtys.get(id) || 0) + item.qty);
      }
    });

    // Check which of the provided items are inventory items
    const inventoryItems = await Inventory.find({
      _id: { $in: newItemsInput.map((i) => i.itemId) },
    });
    const inventoryMap = new Map<string, any>();
    inventoryItems.forEach((inv) => inventoryMap.set(inv._id.toString(), inv));

    // Calculate requested new quantities for inventory items
    const newInventoryQtys = new Map<string, number>();
    newItemsInput.forEach((item) => {
      if (inventoryMap.has(item.itemId)) {
        newInventoryQtys.set(
          item.itemId,
          (newInventoryQtys.get(item.itemId) || 0) + item.qty
        );
      }
    });

    // Validate stock and prepare adjustments
    const allInventoryIds = new Set([
      ...oldInventoryQtys.keys(),
      ...newInventoryQtys.keys(),
    ]);

    for (const itemId of allInventoryIds) {
      const oldQty = oldInventoryQtys.get(itemId) || 0;
      const newQty = newInventoryQtys.get(itemId) || 0;
      const delta = newQty - oldQty; // Positive means we need more stock than we currently have in this order

      if (delta > 0) {
        const inv = inventoryMap.get(itemId);
        if (!inv || inv.quantity < delta) {
          throw {
            status: 400,
            message: `Insufficient quantity for ${
              inv?.name || "Inventory Item"
            }. Available: ${inv?.quantity || 0}, Additional requested: ${delta}`,
          };
        }
      }
    }

    // Apply adjustments to Inventory stock
    for (const itemId of allInventoryIds) {
      const oldQty = oldInventoryQtys.get(itemId) || 0;
      const newQty = newInventoryQtys.get(itemId) || 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        // If delta > 0, we decrease stock. If delta < 0, we increase stock (release).
        await Inventory.findByIdAndUpdate(itemId, {
          $inc: { quantity: -delta },
        });
      }
    }

    // Set updated items on order
    order.items = newItemsInput.map((i) => ({
      itemId: new Types.ObjectId(i.itemId) as any,
      itemModel: (inventoryMap.has(i.itemId) ? "Inventory" : "Item") as "Item" | "Inventory",
      qty: i.qty,
      nameSnapshot: i.nameSnapshot,
      priceSnapshot: i.priceSnapshot,
    }));

    // Recalculate total
    const subtotal = data.items.reduce(
      (s, it) => s + it.priceSnapshot * it.qty,
      0
    );
    order.totalAmount = subtotal;
  }

  if (data.notes !== undefined) {
    order.note = data.notes;
  }

  await order.save();

  await order.populate({
    path: "items.itemId",
    select: "name description price image isAvailable",
    populate: { path: "category", select: "name", strictPopulate: false },
  });
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");
  await populateUserTrackingFields(order);

  return order;
};

export const getOrdersByWaiter = async (
  waiterId: string
): Promise<OrderDoc[]> => {
  return await Order.find({ waiterId: new Types.ObjectId(waiterId) })
    .sort({ createdAt: -1 })
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name", strictPopulate: false },
    })
    .populate("cashierId", "name email phone")
    .populate("cancelledBy", "name email phone")
    .populate("transferredToOwnerBy", "name email phone")
    .populate("confirmedBy", "name email phone")
    .populate("disputedBy", "name email phone");
};

export const getOrdersByCashier = async (
  cashierId: string,
  filters?: {
    status?: OrderStatus | OrderStatus[];
    waiterId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    search?: string;
  }
): Promise<PaginatedResponse<OrderDoc>> => {
  const query: any = { cashierId: new Types.ObjectId(cashierId) };
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;

  // Add status filter if provided (supports single status or array of statuses)
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query.status = { $in: filters.status };
    } else {
      query.status = filters.status;
    }
  }

  // Add waiter filter if provided
  if (filters?.waiterId) {
    query.waiterId = new Types.ObjectId(filters.waiterId);
  }

  // Add date range filter if provided
  if (filters?.startDate || filters?.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      // Ensure startDate is at beginning of day
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (filters.endDate) {
      // Ensure endDate is at end of day (23:59:59.999)
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // Add search filter if provided
  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    const searchRegex = { $regex: searchTerm, $options: "i" };
    query.$or = [
      { orderNumber: searchRegex },
      { tableNumber: searchRegex },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "items.itemId",
        select: "name description price image isAvailable",
        populate: { path: "category", select: "name", strictPopulate: false },
      })
      .populate("waiterId", "name email phone")
      .populate("cancelledBy", "name email phone")
      .populate("transferredToOwnerBy", "name email phone")
      .populate("confirmedBy", "name email phone")
      .populate("disputedBy", "name email phone"),
    Order.countDocuments(query),
  ]);

  return {
    data: orders,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
};

export const markOrderAsPrinted = async (id: string) => {
  const order = await Order.findById(id)
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name", strictPopulate: false },
    })
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone");

  if (order) {
    await populateUserTrackingFields(order);
    // Broadcast status change
    notifyCustomerOrderUpdated(order, {
      updatedFields: { status: order.status },
    });
  }

  return order;
};

export async function printOrder(orderId: string): Promise<{ order: OrderDoc; receiptText: string }> {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // Populate order with items and user details
  await order.populate({
    path: "items.itemId",
    select: "name description price image isAvailable",
    populate: { path: "category", select: "name", strictPopulate: false },
  });
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");
  await populateUserTrackingFields(order);

  // Format receipt text
  const receiptText = formatReceipt(order);

  return { order, receiptText };
}

export const cancelOrder = async (
  id: string,
  userId: string
): Promise<OrderDoc | null> => {
  const order = await Order.findById(id);

  if (!order) {
    throw { status: 404, message: "Order not found" };
  }
  // Validate user permissions
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 401, message: "User not found" };
  }

  // Only cashier can cancel
  if (user.role !== "cashier") {
    throw {
      status: 403,
      message: "Only cashiers can cancel orders",
    };
  }

  // Only cashier who created the order can cancel
  if (order.cashierId?.toString() !== userId) {
    throw {
      status: 403,
      message: "You can only cancel orders you created",
    };
  }

  // Only allowed when status is OPEN
  if (order.status !== "OPEN") {
    throw {
      status: 400,
      message: "Order can only be cancelled when status is OPEN",
    };
  }

  // Set status to VOIDED, cancelledAt timestamp, and cancelledBy user
  order.status = "VOIDED";
  order.cancelledAt = new Date();
  order.cancelledBy = new Types.ObjectId(userId) as any;
  await order.save();

  // Populate order before returning
  await order.populate({
    path: "items.itemId",
    select: "name description price image isAvailable",
    populate: { path: "category", select: "name", strictPopulate: false },
  });
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");
  await populateUserTrackingFields(order);

  // Broadcast status change
  notifyCustomerOrderUpdated(order, {
    updatedFields: { status: order.status },
  });

  return order;
};

// Report Functions

export interface DailyReport {
  date: Date;
  totalOrders: number;
  totalRevenue: number;
  totalCollected: number;
  totalTransferred: number;
  totalConfirmed: number;
  totalVoided: number;
  ordersByStatus: {
    OPEN: number;
    VOIDED: number;
    PAID_TO_CASHIER: number;
    TRANSFERRED_TO_OWNER: number;
    OWNER_CONFIRMED: number;
    DISPUTED: number;
  };
}

export const getDailyReport = async (date?: Date): Promise<DailyReport> => {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const orders = await Order.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const paidToCashier = orders.filter(
    (o) =>
      o.status === "PAID_TO_CASHIER" ||
      o.status === "TRANSFERRED_TO_OWNER" ||
      o.status === "OWNER_CONFIRMED"
  );
  const totalCollected = paidToCashier.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const transferred = orders.filter(
    (o) => o.status === "TRANSFERRED_TO_OWNER" || o.status === "OWNER_CONFIRMED"
  );
  const totalTransferred = transferred.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const confirmed = orders.filter((o) => o.status === "OWNER_CONFIRMED");
  const totalConfirmed = confirmed.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const totalVoided = orders.filter((o) => o.status === "VOIDED").length;

  const ordersByStatus = {
    OPEN: orders.filter((o) => o.status === "OPEN").length,
    VOIDED: orders.filter((o) => o.status === "VOIDED").length,
    PAID_TO_CASHIER: orders.filter((o) => o.status === "PAID_TO_CASHIER")
      .length,
    TRANSFERRED_TO_OWNER: orders.filter(
      (o) => o.status === "TRANSFERRED_TO_OWNER"
    ).length,
    OWNER_CONFIRMED: orders.filter((o) => o.status === "OWNER_CONFIRMED")
      .length,
    DISPUTED: orders.filter((o) => o.status === "DISPUTED").length,
  };

  return {
    date: targetDate,
    totalOrders,
    totalRevenue,
    totalCollected,
    totalTransferred,
    totalConfirmed,
    totalVoided,
    ordersByStatus,
  };
};

export interface CashierReport {
  cashierId: string;
  cashierName?: string;
  totalOrders: number;
  totalCollected: number;
  totalTransferred: number;
  ordersCreated: number;
  ordersCollected: number;
  ordersTransferred: number;
  ordersByStatus: {
    [key in OrderStatus]?: {
      count: number;
      total: number;
    };
  };
}

export const getCashierReport = async (
  cashierId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CashierReport> => {
  const query: any = { cashierId: new Types.ObjectId(cashierId) };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = startDate;
    }
    if (endDate) {
      query.createdAt.$lte = endDate;
    }
  }

  const orders = await Order.find(query).populate(
    "cashierId",
    "name email phone"
  );

  const cashier = orders.length > 0 ? orders[0].cashierId : null;
  const cashierName =
    cashier && typeof cashier === "object" ? (cashier as any).name : undefined;

  const ordersCreated = orders.length;

  const collectedOrders = orders.filter(
    (o) =>
      o.status === "PAID_TO_CASHIER" ||
      o.status === "TRANSFERRED_TO_OWNER" ||
      o.status === "OWNER_CONFIRMED"
  );
  const totalCollected = collectedOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const transferredOrders = orders.filter(
    (o) => o.status === "TRANSFERRED_TO_OWNER" || o.status === "OWNER_CONFIRMED"
  );
  const totalTransferred = transferredOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const ordersWithStatus = await Order.find({
    $or: [
      { cashierId: new Types.ObjectId(cashierId) },
      { transferredToOwnerBy: new Types.ObjectId(cashierId) },
    ],
    ...(startDate || endDate
      ? {
        createdAt: {
          ...(startDate ? { $gte: startDate } : {}),
          ...(endDate ? { $lte: endDate } : {}),
        },
      }
      : {}),
  });

  const ordersByStatus: any = {};
  const statuses: OrderStatus[] = [
    "OPEN",
    "VOIDED",
    "PAID_TO_CASHIER",
    "TRANSFERRED_TO_OWNER",
    "OWNER_CONFIRMED",
    "DISPUTED",
  ];

  statuses.forEach((status) => {
    const filtered = ordersWithStatus.filter((o) => o.status === status);
    ordersByStatus[status] = {
      count: filtered.length,
      total: filtered.reduce((sum, o) => sum + o.totalAmount, 0),
    };
  });

  return {
    cashierId,
    cashierName,
    totalOrders: ordersWithStatus.length,
    totalCollected,
    totalTransferred,
    ordersCreated,
    ordersCollected: collectedOrders.length,
    ordersTransferred: transferredOrders.length,
    ordersByStatus,
  };
};

export interface WaiterReport {
  waiterId: string;
  waiterName?: string;
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
  ordersByStatus: {
    [key in OrderStatus]?: {
      count: number;
      total: number;
    };
  };
}

export const getWaiterReport = async (
  waiterId: string,
  startDate?: Date,
  endDate?: Date
): Promise<WaiterReport> => {
  const query: any = { waiterId: new Types.ObjectId(waiterId) };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = startDate;
    }
    if (endDate) {
      query.createdAt.$lte = endDate;
    }
  }

  const orders = await Order.find(query).populate(
    "waiterId",
    "name email phone"
  );

  const waiter = orders.length > 0 ? orders[0].waiterId : null;
  const waiterName =
    waiter && typeof waiter === "object" ? (waiter as any).name : undefined;

  const totalOrders = orders.length;
  const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const ordersByStatus: any = {};
  const statuses: OrderStatus[] = [
    "OPEN",
    "VOIDED",
    "PAID_TO_CASHIER",
    "TRANSFERRED_TO_OWNER",
    "OWNER_CONFIRMED",
    "DISPUTED",
  ];

  statuses.forEach((status) => {
    const filtered = orders.filter((o) => o.status === status);
    ordersByStatus[status] = {
      count: filtered.length,
      total: filtered.reduce((sum, o) => sum + o.totalAmount, 0),
    };
  });

  return {
    waiterId,
    waiterName,
    totalOrders,
    totalSales,
    averageOrderValue,
    ordersByStatus,
  };
};

export interface StatusReport {
  statusCounts: {
    OPEN: number;
    VOIDED: number;
    PAID_TO_CASHIER: number;
    TRANSFERRED_TO_OWNER: number;
    OWNER_CONFIRMED: number;
    DISPUTED: number;
  };
  totalOrders: number;
}

export const getStatusReport = async (
  startDate?: Date,
  endDate?: Date
): Promise<StatusReport> => {
  const query: any = {};

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = startDate;
    }
    if (endDate) {
      query.createdAt.$lte = endDate;
    }
  }

  const orders = await Order.find(query);

  const statusCounts = {
    OPEN: orders.filter((o) => o.status === "OPEN").length,
    VOIDED: orders.filter((o) => o.status === "VOIDED").length,
    PAID_TO_CASHIER: orders.filter((o) => o.status === "PAID_TO_CASHIER")
      .length,
    TRANSFERRED_TO_OWNER: orders.filter(
      (o) => o.status === "TRANSFERRED_TO_OWNER"
    ).length,
    OWNER_CONFIRMED: orders.filter((o) => o.status === "OWNER_CONFIRMED")
      .length,
    DISPUTED: orders.filter((o) => o.status === "DISPUTED").length,
  };

  return {
    statusCounts,
    totalOrders: orders.length,
  };
};

export interface DateRangeReport {
  startDate: Date;
  endDate: Date;
  totalOrders: number;
  totalRevenue: number;
  totalCollected: number;
  totalTransferred: number;
  totalConfirmed: number;
  totalVoided: number;
  ordersByStatus: {
    OPEN: number;
    VOIDED: number;
    PAID_TO_CASHIER: number;
    TRANSFERRED_TO_OWNER: number;
    OWNER_CONFIRMED: number;
    DISPUTED: number;
  };
}

export const getDateRangeReport = async (
  startDate: Date,
  endDate: Date
): Promise<DateRangeReport> => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end },
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const paidToCashier = orders.filter(
    (o) =>
      o.status === "PAID_TO_CASHIER" ||
      o.status === "TRANSFERRED_TO_OWNER" ||
      o.status === "OWNER_CONFIRMED"
  );
  const totalCollected = paidToCashier.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const transferred = orders.filter(
    (o) => o.status === "TRANSFERRED_TO_OWNER" || o.status === "OWNER_CONFIRMED"
  );
  const totalTransferred = transferred.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const confirmed = orders.filter((o) => o.status === "OWNER_CONFIRMED");
  const totalConfirmed = confirmed.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const totalVoided = orders.filter((o) => o.status === "VOIDED").length;

  const ordersByStatus = {
    OPEN: orders.filter((o) => o.status === "OPEN").length,
    VOIDED: orders.filter((o) => o.status === "VOIDED").length,
    PAID_TO_CASHIER: orders.filter((o) => o.status === "PAID_TO_CASHIER")
      .length,
    TRANSFERRED_TO_OWNER: orders.filter(
      (o) => o.status === "TRANSFERRED_TO_OWNER"
    ).length,
    OWNER_CONFIRMED: orders.filter((o) => o.status === "OWNER_CONFIRMED")
      .length,
    DISPUTED: orders.filter((o) => o.status === "DISPUTED").length,
  };

  return {
    startDate: start,
    endDate: end,
    totalOrders,
    totalRevenue,
    totalCollected,
    totalTransferred,
    totalConfirmed,
    totalVoided,
    ordersByStatus,
  };
};