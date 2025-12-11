import { Types } from "mongoose";
import { Salary, SalaryDoc } from "./salary.model";
import { User } from "../auth/user.model";
import { Withdrawal, WithdrawalDoc } from "./withdrawal.model";
import { Payment, PaymentDoc } from "./payment.model";
import {
  gregorianToEthiopian,
  ethiopianToGregorian,
  formatEthiopianDate,
  parseEthiopianDate,
  getCurrentEthiopianDate,
  addEthiopianMonths,
  daysBetweenEthiopianDates,
} from "../../common/utils/ethiopianCalendar";

export interface CreateSalaryInput {
  staffId: string;
  amount: number;
  month?: string; // YYYY-MM (Gregorian) - auto-calculated
  year?: number; // Gregorian year - auto-calculated
  paymentDate?: Date; // Gregorian payment date - auto-calculated
  status?: "pending" | "paid";
  remarks?: string;
  clientId?: string; // For offline sync idempotency

  // Ethiopian calendar fields (simplified - only registeredDate required)
  registeredDate: string; // YYYY-MM-DD (Ethiopian) - required
  salaryPeriod?: "monthly" | "per_month";
}

export interface UpdateSalaryInput {
  amount?: number;
  status?: "pending" | "paid";
  paymentDate?: Date;
  remarks?: string;
  ethiopianPaymentDate?: string;
  registeredDate?: string; // YYYY-MM-DD (Ethiopian)
  salaryPeriod?: "monthly" | "per_month";
}

export interface CreateWithdrawalInput {
  amount: number;
  reason:
    | "cash"
    | "broke_products"
    | "advance"
    | "deduction"
    | "loan"
    | "other";
  description?: string;
}

export interface CreatePaymentInput {
  amount: number;
  paymentDate?: Date;
  paymentMethod?: "cash" | "bank_transfer" | "check" | "mobile_money" | "other";
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

  // Validate amount
  if (data.amount <= 0) {
    throw { status: 400, message: "Amount must be greater than 0" };
  }

  // Validate staff exists and is not deleted
  const staff = await User.findOne({
    _id: data.staffId,
    isDeleted: { $ne: true },
  });
  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  // Simple approach: Use registeredDate, calculate payment date as 30 days later
  const registeredEthDate = data.registeredDate
    ? parseEthiopianDate(data.registeredDate)
    : getCurrentEthiopianDate();

  // Convert registered date to Gregorian
  const registeredGregorian = ethiopianToGregorian(registeredEthDate);

  // Payment date is 30 days after registration
  const gregorianPaymentDate = new Date(registeredGregorian);
  gregorianPaymentDate.setDate(gregorianPaymentDate.getDate() + 30);

  const gregorianMonth = `${gregorianPaymentDate.getFullYear()}-${String(
    gregorianPaymentDate.getMonth() + 1
  ).padStart(2, "0")}`;
  const gregorianYear = gregorianPaymentDate.getFullYear();

  // Get payment date in Ethiopian calendar
  const paymentEthDate = gregorianToEthiopian(gregorianPaymentDate);

  // Check for duplicate - simple check by staffId only (allow multiple records)
  // Or check if there's an active salary for this staff
  const existing = await Salary.findOne({
    staffId: data.staffId,
    status: "pending",
  });

  if (existing) {
    throw {
      status: 409,
      message: "There is already a pending salary record for this staff member",
    };
  }

  const salary = await Salary.create({
    staffId: new Types.ObjectId(data.staffId),
    amount: data.amount,
    month: gregorianMonth,
    year: gregorianYear,
    paymentDate: gregorianPaymentDate,
    status: data.status || "pending",
    remarks: data.remarks || "",
    createdBy: new Types.ObjectId(createdBy),
    clientId: data.clientId,

    // Ethiopian calendar fields
    ethiopianMonth: paymentEthDate.month,
    ethiopianYear: paymentEthDate.year,
    ethiopianPaymentDate: formatEthiopianDate(paymentEthDate),
    registeredDate: formatEthiopianDate(registeredEthDate),
    salaryPeriod: data.salaryPeriod || "monthly",

    // Initialize tracking fields
    netAmount: data.amount,
    totalWithdrawals: 0,
    totalPayments: 0,
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

  if (data.ethiopianPaymentDate) {
    const ethDate = parseEthiopianDate(data.ethiopianPaymentDate);
    salary.ethiopianPaymentDate = data.ethiopianPaymentDate;
    salary.ethiopianMonth = ethDate.month;
    salary.ethiopianYear = ethDate.year;

    // Update Gregorian payment date from Ethiopian date
    const gregorianDate = ethiopianToGregorian(ethDate);
    salary.paymentDate = gregorianDate;
    salary.month = `${gregorianDate.getFullYear()}-${String(
      gregorianDate.getMonth() + 1
    ).padStart(2, "0")}`;
    salary.year = gregorianDate.getFullYear();
  }

  if (data.salaryPeriod) {
    salary.salaryPeriod = data.salaryPeriod;
  }

  // Handle registeredDate update - recalculate payment date as 30 days from registered date
  if (data.registeredDate) {
    const registeredEthDate = parseEthiopianDate(data.registeredDate);
    salary.registeredDate = data.registeredDate;

    // Convert registered date to Gregorian
    const registeredGregorian = ethiopianToGregorian(registeredEthDate);

    // Payment date is 30 days after registration
    const gregorianPaymentDate = new Date(registeredGregorian);
    gregorianPaymentDate.setDate(gregorianPaymentDate.getDate() + 30);

    // Update payment date fields
    salary.paymentDate = gregorianPaymentDate;
    salary.month = `${gregorianPaymentDate.getFullYear()}-${String(
      gregorianPaymentDate.getMonth() + 1
    ).padStart(2, "0")}`;
    salary.year = gregorianPaymentDate.getFullYear();

    // Update Ethiopian payment date
    const paymentEthDate = gregorianToEthiopian(gregorianPaymentDate);
    salary.ethiopianPaymentDate = formatEthiopianDate(paymentEthDate);
    salary.ethiopianMonth = paymentEthDate.month;
    salary.ethiopianYear = paymentEthDate.year;
  }

  // Recalculate net amount
  salary.netAmount = salary.amount - (salary.totalWithdrawals || 0);

  await salary.save();

  await salary.populate("staffId", "name email phone role");
  await salary.populate("createdBy", "name email");

  return salary;
};

export const deleteSalary = async (id: string): Promise<void> => {
  const salary = await Salary.findById(id);

  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  // Delete associated withdrawals
  await Withdrawal.deleteMany({ salaryId: id });

  // Delete associated payments
  await Payment.deleteMany({ salaryId: id });

  // Delete the salary record
  await Salary.findByIdAndDelete(id);
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

/* ---------------------- WITHDRAWAL MANAGEMENT ---------------------- */

export const createWithdrawal = async (
  salaryId: string,
  data: CreateWithdrawalInput,
  createdBy: string
): Promise<WithdrawalDoc> => {
  const salary = await Salary.findById(salaryId);
  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  if (data.amount <= 0) {
    throw { status: 400, message: "Withdrawal amount must be greater than 0" };
  }

  // Calculate current net amount
  const currentNetAmount = salary.amount - (salary.totalWithdrawals || 0);

  if (data.amount > currentNetAmount) {
    throw {
      status: 400,
      message: `Withdrawal amount (${data.amount}) cannot exceed available amount (${currentNetAmount})`,
    };
  }

  const withdrawal = await Withdrawal.create({
    salaryId: new Types.ObjectId(salaryId),
    amount: data.amount,
    reason: data.reason,
    description: data.description,
    createdBy: new Types.ObjectId(createdBy),
  });

  // Update salary totals
  salary.totalWithdrawals = (salary.totalWithdrawals || 0) + data.amount;
  salary.netAmount = salary.amount - salary.totalWithdrawals;
  await salary.save();

  await withdrawal.populate("createdBy", "name email");
  return withdrawal;
};

export const listWithdrawals = async (salaryId: string) => {
  const withdrawals = await Withdrawal.find({
    salaryId: new Types.ObjectId(salaryId),
  })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return withdrawals;
};

export const deleteWithdrawal = async (withdrawalId: string): Promise<void> => {
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) {
    throw { status: 404, message: "Withdrawal not found" };
  }

  const salary = await Salary.findById(withdrawal.salaryId);
  if (salary) {
    // Revert withdrawal amount
    salary.totalWithdrawals = Math.max(
      0,
      (salary.totalWithdrawals || 0) - withdrawal.amount
    );
    salary.netAmount = salary.amount - salary.totalWithdrawals;
    await salary.save();
  }

  await Withdrawal.findByIdAndDelete(withdrawalId);
};

/* ---------------------- PAYMENT MANAGEMENT ---------------------- */

export const createPayment = async (
  salaryId: string,
  data: CreatePaymentInput,
  createdBy: string
): Promise<PaymentDoc> => {
  const salary = await Salary.findById(salaryId);
  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  if (data.amount <= 0) {
    throw { status: 400, message: "Payment amount must be greater than 0" };
  }

  // Calculate remaining balance
  const remainingBalance =
    (salary.netAmount || salary.amount) - (salary.totalPayments || 0);

  if (data.amount > remainingBalance) {
    throw {
      status: 400,
      message: `Payment amount (${data.amount}) cannot exceed remaining balance (${remainingBalance})`,
    };
  }

  const payment = await Payment.create({
    salaryId: new Types.ObjectId(salaryId),
    amount: data.amount,
    paymentDate: data.paymentDate || new Date(),
    paymentMethod: data.paymentMethod,
    remarks: data.remarks,
    createdBy: new Types.ObjectId(createdBy),
  });

  // Update salary totals
  salary.totalPayments = (salary.totalPayments || 0) + data.amount;

  // Update status if fully paid
  const newRemainingBalance =
    (salary.netAmount || salary.amount) - salary.totalPayments;
  if (newRemainingBalance <= 0) {
    salary.status = "paid";
  }

  await salary.save();

  await payment.populate("createdBy", "name email");
  return payment;
};

export const listPayments = async (salaryId: string) => {
  const payments = await Payment.find({
    salaryId: new Types.ObjectId(salaryId),
  })
    .populate("createdBy", "name email")
    .sort({ paymentDate: -1 })
    .lean();

  return payments;
};

export const deletePayment = async (paymentId: string): Promise<void> => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw { status: 404, message: "Payment not found" };
  }

  const salary = await Salary.findById(payment.salaryId);
  if (salary) {
    // Revert payment amount
    salary.totalPayments = Math.max(
      0,
      (salary.totalPayments || 0) - payment.amount
    );

    // Recalculate status
    const remainingBalance =
      (salary.netAmount || salary.amount) - salary.totalPayments;
    if (remainingBalance > 0) {
      salary.status = "pending";
    }

    await salary.save();
  }

  await Payment.findByIdAndDelete(paymentId);
};

/* ---------------------- COUNTDOWN CALCULATION ---------------------- */

export const calculateCountdown = async (salaryId: string) => {
  const salary = await Salary.findById(salaryId);
  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  if (!salary.registeredDate) {
    throw {
      status: 400,
      message: "Salary record must have registered date",
    };
  }

  // Simple calculation: 30 days from registered date
  const registeredDate = parseEthiopianDate(salary.registeredDate);
  const registeredGregorian = ethiopianToGregorian(registeredDate);

  // Add 30 days to registered date
  const nextPaymentGregorian = new Date(registeredGregorian);
  nextPaymentGregorian.setDate(nextPaymentGregorian.getDate() + 30);

  // Calculate days until next payment
  const now = new Date();
  const diffMs = nextPaymentGregorian.getTime() - now.getTime();
  const daysUntil = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  // Convert back to Ethiopian for display
  const nextPaymentEthiopian = gregorianToEthiopian(nextPaymentGregorian);

  return {
    daysUntil,
    totalDays: 30, // Total countdown period
    nextPaymentDate: {
      ethiopian: formatEthiopianDate(nextPaymentEthiopian),
      gregorian: nextPaymentGregorian.toISOString(),
    },
    registeredDate: salary.registeredDate,
    registeredDateGregorian: registeredGregorian.toISOString(),
  };
};

/* ---------------------- NET AMOUNT CALCULATION ---------------------- */

export const getNetAmount = async (salaryId: string): Promise<number> => {
  const salary = await Salary.findById(salaryId);
  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  // Recalculate from withdrawals
  const withdrawals = await Withdrawal.find({
    salaryId: new Types.ObjectId(salaryId),
  }).lean();

  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  const netAmount = salary.amount - totalWithdrawals;

  // Update salary record
  salary.totalWithdrawals = totalWithdrawals;
  salary.netAmount = netAmount;
  await salary.save();

  return netAmount;
};
