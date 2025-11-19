import { Schema, model, Document, Types } from "mongoose";

export interface ShiftDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  staffId: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  status: "active" | "completed";
  ordersHandled: Types.ObjectId[];
  revenue: number;
  notes?: string;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<ShiftDoc>(
  {
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },
    ordersHandled: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    revenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
    },
    clientId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

// Indexes for performance
ShiftSchema.index({ staffId: 1, status: 1 });
ShiftSchema.index({ startTime: -1 });
ShiftSchema.index({ staffId: 1, startTime: -1 });

export const Shift = model<ShiftDoc>("Shift", ShiftSchema);
