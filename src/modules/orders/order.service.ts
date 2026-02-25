import { Types } from "mongoose";
import { formatReceipt } from "../../common/utils/receiptFormatter";
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
        populate: { path: "category", select: "name" },
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

  const orderNumber = await generateOrderNumber();

  const order = await Order.create({
    orderNumber,
    tableNumber: payload.tableNumber,
    items: payload.items.map((i) => ({
      itemId: new Types.ObjectId(i.itemId) as any,
      qty: i.qty,
      nameSnapshot: i.nameSnapshot,
      priceSnapshot: i.priceSnapshot,
    })),
    note: payload.note,
    totalAmount: subtotal,
    status: payload.markAsPaidToCashier ? "PAID_TO_CASHIER" : "OPEN",
    placedAt: new Date(),
    paymentReceivedAt: payload.markAsPaidToCashier ? new Date() : undefined,
    waiterId: new Types.ObjectId(payload.waiterId),
    cashierId: cashierId ? new Types.ObjectId(cashierId) : undefined,
    clientId: payload.clientId,
  });

  // Decrement inventory quantities after order creation
  for (const { inventory, qty } of inventoryItemsToUpdate) {
    inventory.quantity -= qty;
    await inventory.save();
  }

  // Populate item details with categories before returning
  await order.populate({
    path: "items.itemId",
    select: "name description price image isAvailable",
    populate: { path: "category", select: "name" },
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
}

export const listOrders = async (
  filters: ListOrdersFilters = {}
): Promise<OrderDoc[]> => {
  const query: any = {};

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
      // Ensure startDate is at beginning of day
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (filters.endDate) {
      // Ensure endDate is at end of day
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // Handle search separately to avoid conflicts with other filters
  // First, get all orders matching base filters (status, waiterId, cashierId, dates, etc.)
  // We populate waiter and cashier first so we can search in their names/emails
  let orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name" },
    })
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone")
    .populate("cancelledBy", "name email phone")
    .populate("transferredToOwnerBy", "name email phone")
    .populate("confirmedBy", "name email phone")
    .populate("disputedBy", "name email phone");

  // If search is provided, filter by search term (case-insensitive)
  // Search across: orderNumber, tableNumber, waiter name/email, cashier name/email
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.trim().toLowerCase();
    const filteredOrders = orders.filter((order: any) => {
      // Search in orderNumber (case-insensitive, partial match)
      const orderNumberMatch =
        order.orderNumber &&
        String(order.orderNumber).toLowerCase().includes(searchTerm);

      // Search in tableNumber (case-insensitive)
      const tableNumberMatch =
        order.tableNumber &&
        String(order.tableNumber).toLowerCase().includes(searchTerm);

      // Search in waiter name (case-insensitive)
      const waiterNameMatch =
        order.waiterId &&
        typeof order.waiterId === "object" &&
        order.waiterId.name &&
        String(order.waiterId.name).toLowerCase().includes(searchTerm);

      // Search in waiter email (case-insensitive)
      const waiterEmailMatch =
        order.waiterId &&
        typeof order.waiterId === "object" &&
        order.waiterId.email &&
        String(order.waiterId.email).toLowerCase().includes(searchTerm);

      // Search in cashier name (case-insensitive)
      const cashierNameMatch =
        order.cashierId &&
        typeof order.cashierId === "object" &&
        order.cashierId.name &&
        String(order.cashierId.name).toLowerCase().includes(searchTerm);

      // Search in cashier email (case-insensitive)
      const cashierEmailMatch =
        order.cashierId &&
        typeof order.cashierId === "object" &&
        order.cashierId.email &&
        String(order.cashierId.email).toLowerCase().includes(searchTerm);

      // Return true if any field matches
      return (
        orderNumberMatch ||
        tableNumberMatch ||
        waiterNameMatch ||
        waiterEmailMatch ||
        cashierNameMatch ||
        cashierEmailMatch
      );
    });
    return filteredOrders as OrderDoc[];
  }

  return orders;
};

export const getOwnerOrders = async (
  filters: ListOrdersFilters = {}
): Promise<OrderDoc[]> => {
  // Owner-specific order retrieval - no role-based restrictions
  // Supports all filters: status, waiterId, cashierId, startDate, endDate, search, tableNumber
  const query: any = {};

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
      // Ensure startDate is at beginning of day
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (filters.endDate) {
      // Ensure endDate is at end of day
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // Handle search separately to avoid conflicts with other filters
  // First, get all orders matching base filters (status, waiterId, cashierId, dates, etc.)
  // We populate waiter and cashier first so we can search in their names/emails
  let orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name" },
    })
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone")
    .populate("cancelledBy", "name email phone")
    .populate("transferredToOwnerBy", "name email phone")
    .populate("confirmedBy", "name email phone")
    .populate("disputedBy", "name email phone");

  // If search is provided, filter by search term (case-insensitive)
  // Search across: orderNumber, tableNumber, waiter name/email, cashier name/email
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.trim().toLowerCase();
    const filteredOrders = orders.filter((order: any) => {
      // Search in orderNumber (case-insensitive, partial match)
      const orderNumberMatch =
        order.orderNumber &&
        String(order.orderNumber).toLowerCase().includes(searchTerm);

      // Search in tableNumber (case-insensitive)
      const tableNumberMatch =
        order.tableNumber &&
        String(order.tableNumber).toLowerCase().includes(searchTerm);

      // Search in waiter name (case-insensitive)
      const waiterNameMatch =
        order.waiterId &&
        typeof order.waiterId === "object" &&
        order.waiterId.name &&
        String(order.waiterId.name).toLowerCase().includes(searchTerm);

      // Search in waiter email (case-insensitive)
      const waiterEmailMatch =
        order.waiterId &&
        typeof order.waiterId === "object" &&
        order.waiterId.email &&
        String(order.waiterId.email).toLowerCase().includes(searchTerm);

      // Search in cashier name (case-insensitive)
      const cashierNameMatch =
        order.cashierId &&
        typeof order.cashierId === "object" &&
        order.cashierId.name &&
        String(order.cashierId.name).toLowerCase().includes(searchTerm);

      // Search in cashier email (case-insensitive)
      const cashierEmailMatch =
        order.cashierId &&
        typeof order.cashierId === "object" &&
        order.cashierId.email &&
        String(order.cashierId.email).toLowerCase().includes(searchTerm);

      // Return true if any field matches
      return (
        orderNumberMatch ||
        tableNumberMatch ||
        waiterNameMatch ||
        waiterEmailMatch ||
        cashierNameMatch ||
        cashierEmailMatch
      );
    });
    return filteredOrders as OrderDoc[];
  }

  return orders;
};

export const getOrder = async (id: string): Promise<OrderDoc | null> => {
  const order = await Order.findById(id)
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name" },
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
  OPEN: ["VOIDED", "PAID_TO_CASHIER"],
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
  paymentProofImageFile?: Express.Multer.File
): Promise<OrderDoc | null> => {
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
    // Cashier can: OPEN → VOIDED or PAID_TO_CASHIER
    if (
      order.status === "OPEN" &&
      status !== "VOIDED" &&
      status !== "PAID_TO_CASHIER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only void or mark as paid to cashier from OPEN status",
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
    } else if (paymentMethod === "mobile_banking" && !paymentProofImageFile) {
      // Require payment proof image for mobile banking
      throw {
        status: 400,
        message: "Payment proof image is required for mobile banking payments",
      };
    } else if (paymentMethod === "cash" && order.paymentProofImage) {
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

  return order;
};

/**
 * Bulk update order statuses
 * Only updates orders that have the same current status
 */
export const bulkUpdateOrderStatus = async (
  orderIds: string[],
  newStatus: OrderStatus,
  userId: string
): Promise<{
  updated: OrderDoc[];
  failed: Array<{ id: string; reason: string }>;
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
    // Cashier can: OPEN → VOIDED or PAID_TO_CASHIER
    if (
      firstOrderStatus === "OPEN" &&
      newStatus !== "VOIDED" &&
      newStatus !== "PAID_TO_CASHIER"
    ) {
      throw {
        status: 403,
        message:
          "Cashier can only void or mark as paid to cashier from OPEN status",
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
      } else if (newStatus === "TRANSFERRED_TO_OWNER") {
        order.paymentDeliveredAt = now;
        order.transferredToOwnerBy = userIdObjectId as any;
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

      updated.push(order);
    } catch (error: any) {
      failed.push({
        id: String(order._id),
        reason: error.message || "Failed to update order",
      });
    }
  }

  return { updated, failed };
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
    order.items = data.items.map((i) => ({
      itemId: new Types.ObjectId(i.itemId) as any,
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
    populate: { path: "category", select: "name" },
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
      populate: { path: "category", select: "name" },
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
  }
): Promise<OrderDoc[]> => {
  const query: any = { cashierId: new Types.ObjectId(cashierId) };

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

  return await Order.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name" },
    })
    .populate("waiterId", "name email phone")
    .populate("cancelledBy", "name email phone")
    .populate("transferredToOwnerBy", "name email phone")
    .populate("confirmedBy", "name email phone")
    .populate("disputedBy", "name email phone");
};

export const markOrderAsPrinted = async (id: string) => {
  const order = await Order.findById(id)
    .populate({
      path: "items.itemId",
      select: "name description price image isAvailable",
      populate: { path: "category", select: "name" },
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
    populate: { path: "category", select: "name" },
  });
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");
  await populateUserTrackingFields(order);

  console.log(
    `[PRINT ORDER] Order ${order.orderNumber} receipt text requested`
  );

  // Format receipt text
  const receiptText = formatReceipt(order);

  return { order, receiptText };
}

export const cancelOrder = async (
  id: string,
  userId: string
): Promise<OrderDoc | null> => {
  const order = await Order.findById(id);


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
    populate: { path: "category", select: "name" },
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

  return {
    cashierId,
    cashierName,
    totalOrders: ordersWithStatus.length,
    totalCollected,
    totalTransferred,
    ordersCreated,
    ordersCollected: collectedOrders.length,
    ordersTransferred: transferredOrders.length,
  };
};

export interface WaiterReport {
  waiterId: string;
  waiterName?: string;
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
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

  return {
    waiterId,
    waiterName,
    totalOrders,
    totalSales,
    averageOrderValue,
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
