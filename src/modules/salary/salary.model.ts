import { Schema, model, Document, Types } from "mongoose";

export interface SalaryDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  staffId: Types.ObjectId;
  amount: number;
  month: string; // YYYY-MM format (Gregorian)
  year: number; // Gregorian year
  paymentDate: Date; // Gregorian payment date
  status: "pending" | "paid";
  remarks?: string;
  createdBy: Types.ObjectId;
  clientId?: string;

  // Ethiopian calendar fields
  ethiopianMonth?: number; // 1-13 (13 is Pagume)
  ethiopianYear?: number;
  ethiopianPaymentDate?: string; // Format: YYYY-MM-DD (Ethiopian)
  registeredDate?: string; // Ethiopian date when salary was registered (YYYY-MM-DD)
  salaryPeriod?: "monthly" | "per_month"; // Salary payment period

  // Withdrawal and payment tracking
  netAmount?: number; // Calculated: amount - totalWithdrawals
  totalWithdrawals?: number; // Sum of all withdrawals
  totalPayments?: number; // Sum of all payments made

  createdAt: Date;
  updatedAt: Date;
}

const SalarySchema = new Schema<SalaryDoc>(
  {
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    month: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}$/, // YYYY-MM format
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
      index: true,
    },
    remarks: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: { type: String, sparse: true, unique: true },

    // Ethiopian calendar fields
    ethiopianMonth: {
      type: Number,
      min: 1,
      max: 13,
      index: true,
    },
    ethiopianYear: {
      type: Number,
      index: true,
    },
    ethiopianPaymentDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD format
    },
    registeredDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD format (Ethiopian)
      index: true,
    },
    salaryPeriod: {
      type: String,
      enum: ["monthly", "per_month"],
      default: "monthly",
    },

    // Withdrawal and payment tracking
    netAmount: {
      type: Number,
      min: 0,
      default: function () {
        return this.amount || 0;
      },
    },
    totalWithdrawals: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalPayments: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate salary for same staff/month/year
SalarySchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });
// Indexes for analytics
SalarySchema.index({ month: 1, year: 1, status: 1 });
SalarySchema.index({ paymentDate: -1 });
SalarySchema.index({ ethiopianYear: 1, ethiopianMonth: 1 });
// Note: registeredDate already has index: true in field definition (line 94), no need for duplicatecdcdcd

export const Salary = model<SalaryDoc>("Salary", SalarySchema);
