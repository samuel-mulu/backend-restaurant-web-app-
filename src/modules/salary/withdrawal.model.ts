import { Schema, model, Document, Types } from "mongoose";

export interface WithdrawalDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  salaryId: Types.ObjectId;
  amount: number;
  reason: string; // "cash", "broke_products", "other", etc.
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema = new Schema<WithdrawalDoc>(
  {
    salaryId: {
      type: Schema.Types.ObjectId,
      ref: "Salary",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      enum: ["cash", "broke_products", "advance", "deduction", "loan", "other"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance
WithdrawalSchema.index({ salaryId: 1, createdAt: -1 });
// Note: reason already has index: true in field definition, no need for duplicate

export const Withdrawal = model<WithdrawalDoc>("Withdrawal", WithdrawalSchema);
