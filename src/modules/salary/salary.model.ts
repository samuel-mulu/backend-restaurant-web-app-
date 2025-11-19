import { Schema, model, Document, Types } from "mongoose";

export interface SalaryDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  staffId: Types.ObjectId;
  amount: number;
  month: string; // YYYY-MM format
  year: number;
  paymentDate: Date;
  status: "pending" | "paid";
  remarks?: string;
  createdBy: Types.ObjectId;
  clientId?: string;
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
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate salary for same staff/month/year
SalarySchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });
// Indexes for analytics
SalarySchema.index({ month: 1, year: 1, status: 1 });
SalarySchema.index({ paymentDate: -1 });

export const Salary = model<SalaryDoc>("Salary", SalarySchema);
