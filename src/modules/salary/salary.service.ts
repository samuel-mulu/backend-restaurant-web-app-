import { Types } from "mongoose";
import { Salary, SalaryDoc } from "./salary.model";
import { User } from "../auth/user.model";

export interface CreateSalaryInput {
  staffId: string;
  amount: number;
  month: string; // YYYY-MM
  year: number;
  paymentDate: Date;
  status?: "pending" | "paid";
  remarks?: string;
  clientId?: string; // For offline sync idempotency
}

export interface UpdateSalaryInput {
  amount?: number;
  status?: "pending" | "paid";
  paymentDate?: Date;
  remarks?: string;
}

export interface ListSalaryFilters {
  staffId?: string;
  month?: string;
  year?: number;
  status?: "pending" | "paid";
  page?: number;
  limit?: number;
}

export const listSalaries = async (filters: ListSalaryFilters = {}) => {
  const { staffId, month, year, status, page = 1, limit = 50 } = filters;
  const query: any = {};

  if (staffId) {
    query.staffId = new Types.ObjectId(staffId);
  }

  if (month) {
    query.month = month;
  }

  if (year) {
    query.year = year;
  }

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [salaries, total] = await Promise.all([
    Salary.find(query)
      .populate("staffId", "name email phone role")
      .populate("createdBy", "name email")
      .sort({ year: -1, month: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Salary.countDocuments(query),
  ]);

  return {
    salaries,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getSalaryById = async (id: string): Promise<SalaryDoc | null> => {
  const salary = await Salary.findById(id)
    .populate("staffId", "name email phone role")
    .populate("createdBy", "name email")
    .lean();

  return salary as any;
};

export const createSalary = async (
  data: CreateSalaryInput,
  createdBy: string
): Promise<SalaryDoc> => {
  // Check for idempotency if clientId provided
  if (data.clientId) {
    const existing = await Salary.findOne({ clientId: data.clientId });
    if (existing) {
      await existing.populate("staffId", "name email phone role");
      await existing.populate("createdBy", "name email");
      return existing;
    }
  }

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(data.month)) {
    throw { status: 400, message: "Month must be in YYYY-MM format" };
  }

  // Validate amount
  if (data.amount <= 0) {
    throw { status: 400, message: "Amount must be greater than 0" };
  }

  // Validate staff exists and is active
  const staff = await User.findById(data.staffId);
  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  if (staff.status !== "active" || !staff.isActive) {
    throw { status: 400, message: "Staff member is not active" };
  }

  // Check for duplicate (compound unique index will also prevent this, but we check first for better error message)
  const existing = await Salary.findOne({
    staffId: data.staffId,
    month: data.month,
    year: data.year,
  });

  if (existing) {
    throw {
      status: 409,
      message:
        "Salary record already exists for this staff member, month, and year",
    };
  }

  const salary = await Salary.create({
    staffId: new Types.ObjectId(data.staffId),
    amount: data.amount,
    month: data.month,
    year: data.year,
    paymentDate: data.paymentDate,
    status: data.status || "pending",
    remarks: data.remarks,
    createdBy: new Types.ObjectId(createdBy),
    clientId: data.clientId,
  });

  await salary.populate("staffId", "name email phone role");
  await salary.populate("createdBy", "name email");

  return salary;
};

export const updateSalary = async (
  id: string,
  data: UpdateSalaryInput
): Promise<SalaryDoc | null> => {
  const salary = await Salary.findById(id);

  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  if (data.amount !== undefined) {
    if (data.amount <= 0) {
      throw { status: 400, message: "Amount must be greater than 0" };
    }
    salary.amount = data.amount;
  }

  if (data.status) {
    salary.status = data.status;
  }

  if (data.paymentDate) {
    salary.paymentDate = data.paymentDate;
  }

  if (data.remarks !== undefined) {
    salary.remarks = data.remarks;
  }

  await salary.save();

  await salary.populate("staffId", "name email phone role");
  await salary.populate("createdBy", "name email");

  return salary;
};

export const getSalarySummary = async (filters: {
  month?: string;
  year?: number;
}) => {
  const { month, year } = filters;
  const matchQuery: any = {};

  if (month) {
    matchQuery.month = month;
  }

  if (year) {
    matchQuery.year = year;
  }

  const summary = await Salary.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$staffId",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        paidCount: {
          $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
        },
        pendingCount: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "staff",
      },
    },
    { $unwind: "$staff" },
    {
      $project: {
        staffId: "$_id",
        staffName: "$staff.name",
        staffEmail: "$staff.email",
        staffPhone: "$staff.phone",
        totalAmount: 1,
        count: 1,
        paidCount: 1,
        pendingCount: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const totals = await Salary.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalCount: { $sum: 1 },
        totalPaid: {
          $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] },
        },
        totalPending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
        },
      },
    },
  ]);

  return {
    summary,
    totals: totals[0] || {
      totalAmount: 0,
      totalCount: 0,
      totalPaid: 0,
      totalPending: 0,
    },
  };
};

export const getStaffSalaryHistory = async (staffId: string) => {
  const salaries = await Salary.find({ staffId: new Types.ObjectId(staffId) })
    .populate("createdBy", "name email")
    .sort({ year: -1, month: -1 })
    .lean();

  return salaries;
};
