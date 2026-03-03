import { Schema, model, Document, Types } from "mongoose";

export interface ExpenseDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  amount: number;
  reason: string;
  description?: string;
  date: Date;
  staffId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
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
ExpenseSchema.index({ date: -1 });

export const Expense = model<ExpenseDoc>("Expense", ExpenseSchema);
