import { Schema, model, Document, Types } from "mongoose";

export type AssignmentStatus = "pending" | "approved" | "rejected";

export interface InventoryAssignmentDoc extends Document {
  _id: Types.ObjectId;
  inventoryId: Types.ObjectId;
  barmanId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedQuantity: number;
  approvedQuantity?: number;
  remainingQuantity: number;
  status: AssignmentStatus;
  approvedAt?: Date;
  rejectedAt?: Date;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryAssignmentSchema = new Schema<InventoryAssignmentDoc>(
  {
    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    barmanId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedQuantity: {
      type: Number,
      min: 0,
    },
    remainingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    approvedAt: Date,
    rejectedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

InventoryAssignmentSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

InventoryAssignmentSchema.index({ inventoryId: 1, status: 1 });
InventoryAssignmentSchema.index({ barmanId: 1, status: 1 });

export const InventoryAssignment = model<InventoryAssignmentDoc>(
  "InventoryAssignment",
  InventoryAssignmentSchema
);
