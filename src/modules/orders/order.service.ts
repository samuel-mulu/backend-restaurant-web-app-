import { Types } from "mongoose";
import { Order, OrderDoc, OrderStatus } from "./order.model";
import {
  notifyCashiersNewOrder,
  notifyCustomerOrderUpdated,
} from "../../sockets/events";
import { User } from "../auth/user.model";

const genCode = (prefix = "GAR") =>
  `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

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
    typeSnapshot: "food" | "beverage";
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
  // Check for idempotency if clientId provided
  if (payload.clientId) {
    const existing = await Order.findOne({ clientId: payload.clientId });
    if (existing) {
      await existing.populate(
        "items.itemId",
        "name description price images isAvailable"
      );
      await existing.populate("waiterId", "name email phone");
      await existing.populate("cashierId", "name email phone");
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
    orderCode: genCode(),
    orderNumber,
    tableNumber: payload.tableNumber,
    items: payload.items.map((i) => ({
      itemId: new Types.ObjectId(i.itemId) as any,
      typeSnapshot: i.typeSnapshot,
      qty: i.qty,
      nameSnapshot: i.nameSnapshot,
      priceSnapshot: i.priceSnapshot,
    })),
    note: payload.note,
    totalAmount: subtotal,
    status: "placed",
    waiterId: new Types.ObjectId(payload.waiterId),
    cashierId: cashierId ? new Types.ObjectId(cashierId) : undefined,
    clientId: payload.clientId,
  });

  // Populate item details before returning
  await order.populate(
    "items.itemId",
    "name description price images isAvailable ingredients"
  );
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");

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

  return await Order.find(query)
    .sort({ createdAt: -1 })
    .populate(
      "items.itemId",
      "name description price images isAvailable ingredients"
    )
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone");
};

export const getOrder = async (id: string): Promise<OrderDoc | null> => {
  return await Order.findById(id)
    .populate(
      "items.itemId",
      "name description price images isAvailable ingredients"
    )
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone");
};

// Valid status transitions: placed → served → completed
const validStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  placed: ["served"],
  served: ["completed"],
  completed: [], // Terminal state
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

  // Waiter can only update to served/completed
  if (user.role === "waiter" && !["served", "completed"].includes(status)) {
    throw {
      status: 403,
      message: "Waiters can only update order status to served or completed",
    };
  }

  // Only waiter assigned to order can update it
  if (user.role === "waiter" && order.waiterId?.toString() !== userId) {
    throw {
      status: 403,
      message: "You can only update orders assigned to you",
    };
  }

  order.status = status;
  await order.save();

  await order.populate(
    "items.itemId",
    "name description price images isAvailable ingredients"
  );
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");

  // Broadcast status change
  notifyCustomerOrderUpdated(order, { updatedFields: { status } });

  return order;
};

export interface UpdateOrderInput {
  notes?: string;
  items?: {
    itemId: string;
    typeSnapshot: "food" | "beverage";
    qty: number;
    nameSnapshot: string;
    priceSnapshot: number;
  }[];
}

export const updateOrder = async (
  id: string,
  data: UpdateOrderInput
): Promise<OrderDoc | null> => {
  const order = await Order.findById(id);

  if (!order) {
    throw { status: 404, message: "Order not found" };
  }

  // Update items if provided
  if (data.items) {
    order.items = data.items.map((i) => ({
      itemId: new Types.ObjectId(i.itemId) as any,
      typeSnapshot: i.typeSnapshot,
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

  await order.populate(
    "items.itemId",
    "name description price images isAvailable ingredients"
  );
  await order.populate("waiterId", "name email phone");
  await order.populate("cashierId", "name email phone");

  return order;
};

export const getOrdersByWaiter = async (
  waiterId: string
): Promise<OrderDoc[]> => {
  return await Order.find({ waiterId: new Types.ObjectId(waiterId) })
    .sort({ createdAt: -1 })
    .populate(
      "items.itemId",
      "name description price images isAvailable ingredients"
    )
    .populate("cashierId", "name email phone");
};

export const getOrdersByCashier = async (
  cashierId: string
): Promise<OrderDoc[]> => {
  return await Order.find({ cashierId: new Types.ObjectId(cashierId) })
    .sort({ createdAt: -1 })
    .populate(
      "items.itemId",
      "name description price images isAvailable ingredients"
    )
    .populate("waiterId", "name email phone");
};

export const markOrderAsPrinted = async (id: string) => {
  const order = await Order.findById(id)
    .populate(
      "items.itemId",
      "name description price images isAvailable ingredients"
    )
    .populate("waiterId", "name email phone")
    .populate("cashierId", "name email phone");

  if (order) {
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
  console.log(`[PRINT ORDER] Order ${order.orderCode} requested for printing`);

  return order;
}
