import { Shift, ShiftDoc } from "./shifts.model";
import { User } from "../auth/user.model";
import { Order } from "../orders/order.model";
import { Types } from "mongoose";

export interface CreateShiftInput {
  staffId: string;
  notes?: string;
  clientId?: string;
}

export interface UpdateShiftInput {
  endTime?: Date;
  notes?: string;
}

export interface ListShiftFilters {
  staffId?: string;
  status?: "active" | "completed";
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export const startShift = async (data: CreateShiftInput): Promise<ShiftDoc> => {
  // Check if staff member exists and is active
  const staff = await User.findById(data.staffId);
  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  if (staff.role !== "cashier" && staff.role !== "waiter") {
    throw { status: 400, message: "User is not a cashier or waiter" };
  }

  if (staff.status !== "active") {
    throw { status: 400, message: "Staff member is not active" };
  }

  // Check if there's an active shift for this staff member
  const activeShift = await Shift.findOne({
    staffId: data.staffId,
    status: "active",
  });

  if (activeShift) {
    throw { status: 400, message: "Staff member already has an active shift" };
  }

  // Check for idempotency if clientId provided
  if (data.clientId) {
    const existingShift = await Shift.findOne({ clientId: data.clientId });
    if (existingShift) {
      return existingShift;
    }
  }

  const shift = await Shift.create({
    staffId: data.staffId,
    startTime: new Date(),
    status: "active",
    ordersHandled: [],
    revenue: 0,
    notes: data.notes,
    clientId: data.clientId,
  });

  return shift;
};

export const endShift = async (
  shiftId: string,
  data?: UpdateShiftInput
): Promise<ShiftDoc | null> => {
  const shift = await Shift.findById(shiftId);

  if (!shift) {
    throw { status: 404, message: "Shift not found" };
  }

  if (shift.status === "completed") {
    throw { status: 400, message: "Shift is already completed" };
  }

  // Calculate revenue from completed orders
  const orders = await Order.find({
    _id: { $in: shift.ordersHandled },
    status: "completed",
  });

  const revenue = orders.reduce(
    (sum, order) => sum + (order.totalAmount || 0),
    0
  );

  shift.endTime = data?.endTime || new Date();
  shift.status = "completed";
  shift.revenue = revenue;
  if (data?.notes) {
    shift.notes = data.notes;
  }

  await shift.save();

  return shift;
};

export const listShifts = async (filters: ListShiftFilters = {}) => {
  const { staffId, status, startDate, endDate, page = 1, limit = 50 } = filters;

  const query: any = {};

  if (staffId) {
    query.staffId = new Types.ObjectId(staffId);
  }

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) {
      query.startTime.$gte = startDate;
    }
    if (endDate) {
      query.startTime.$lte = endDate;
    }
  }

  const skip = (page - 1) * limit;

  const [shifts, total] = await Promise.all([
    Shift.find(query)
      .populate("staffId", "name email role")
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Shift.countDocuments(query),
  ]);

  return {
    shifts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getShiftById = async (id: string): Promise<ShiftDoc | null> => {
  const shift = await Shift.findById(id)
    .populate("staffId", "name email role")
    .populate("ordersHandled")
    .lean();

  return shift as any;
};

export const getActiveShift = async (
  staffId: string
): Promise<ShiftDoc | null> => {
  const shift = await Shift.findOne({
    staffId,
    status: "active",
  })
    .populate("ordersHandled")
    .lean();

  return shift as any;
};

export const getShiftHistory = async (staffId: string) => {
  const shifts = await Shift.find({
    staffId,
    status: "completed",
  })
    .sort({ startTime: -1 })
    .limit(30)
    .lean();

  return shifts;
};

export const calculateShiftRevenue = async (
  shiftId: string
): Promise<number> => {
  const shift = await Shift.findById(shiftId);

  if (!shift) {
    throw { status: 404, message: "Shift not found" };
  }

  const orders = await Order.find({
    _id: { $in: shift.ordersHandled },
    status: "completed",
  });

  const revenue = orders.reduce(
    (sum, order) => sum + (order.totalAmount || 0),
    0
  );

  // Update shift revenue
  shift.revenue = revenue;
  await shift.save();

  return revenue;
};

export const addOrderToShift = async (
  shiftId: string,
  orderId: string
): Promise<void> => {
  const shift = await Shift.findById(shiftId);

  if (!shift) {
    throw { status: 404, message: "Shift not found" };
  }

  if (shift.status === "completed") {
    throw { status: 400, message: "Cannot add order to completed shift" };
  }

  if (!shift.ordersHandled.includes(new Types.ObjectId(orderId))) {
    shift.ordersHandled.push(new Types.ObjectId(orderId));
    await shift.save();
  }
};
