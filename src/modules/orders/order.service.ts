import { Types } from "mongoose";
import { Order, OrderDoc, OrderStatus, fixOrderCodeIndex } from "./order.model";
import {
  notifyCashiersNewOrder,
  notifyCustomerOrderUpdated,
} from "../../sockets/events";
import { User } from "../auth/user.model";

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
  tableNumber: string;
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
};

export const createOrder = async (
  payload: CreateOrderInput,
  cashierId?: string
): Promise<OrderDoc> => {
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
      return existing;
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
    status: "OPEN",
    placedAt: new Date(),
    waiterId: new Types.ObjectId(payload.waiterId),
    cashierId: cashierId ? new Types.ObjectId(cashierId) : undefined,
    clientId: payload.clientId,
  });

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

  return order;
};

export interface ListOrdersFilters {
  status?: OrderStatus;
  waiterId?: string;
  cashierId?: string;
  startDate?: Date;
  endDate?: Date;
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

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      query.createdAt.$lte = filters.endDate;
    }
  }

  const orders = await Order.find(query)
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
  VOIDED: [], // Terminal state
  PAID_TO_CASHIER: ["TRANSFERRED_TO_OWNER", "DISPUTED"],
  TRANSFERRED_TO_OWNER: ["OWNER_CONFIRMED", "DISPUTED"],
  DISPUTED: ["PAID_TO_CASHIER", "TRANSFERRED_TO_OWNER"],
  OWNER_CONFIRMED: [], // Terminal state
};

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus,
  userId: string
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
    // Owner can: TRANSFERRED_TO_OWNER → OWNER_CONFIRMED or DISPUTED
    if (
      order.status === "TRANSFERRED_TO_OWNER" &&
      status !== "OWNER_CONFIRMED" &&
      status !== "DISPUTED"
    ) {
      throw {
        status: 403,
        message:
          "Owner can only confirm or dispute from TRANSFERRED_TO_OWNER status",
      };
    }
    // Owner cannot perform other transitions
    if (order.status !== "TRANSFERRED_TO_OWNER") {
      throw {
        status: 403,
        message: "Owner can only update orders in TRANSFERRED_TO_OWNER status",
      };
    }
  }

  // Set status, corresponding timestamp, and user tracking
  order.status = status;
  const now = new Date();
  const userIdObjectId = new Types.ObjectId(userId);

  if (status === "VOIDED") {
    order.cancelledAt = now;
    order.cancelledBy = userIdObjectId as any;
  } else if (status === "PAID_TO_CASHIER") {
    order.paymentReceivedAt = now;
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
  cashierId: string
): Promise<OrderDoc[]> => {
  return await Order.find({ cashierId: new Types.ObjectId(cashierId) })
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

export async function printOrder(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // For now, just return the order
  // Printing functionality can be added later if needed
  console.log(
    `[PRINT ORDER] Order ${order.orderNumber} requested for printing`
  );

  return order;
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
