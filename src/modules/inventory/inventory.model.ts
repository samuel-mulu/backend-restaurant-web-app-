import { Schema, model, Document, Types } from "mongoose";

export interface InventoryDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price: number;
  isBarman: boolean;
  clientId?: string;
  approvalStatus: "pendingapproval" | "approved" | "rejected";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  /** Virtuals */
  isLowStock: boolean;
  stockStatus: "low" | "normal";
  id: string; // virtual
}

const InventorySchema = new Schema<InventoryDoc>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    isBarman: {
      type: Boolean,
      default: false,
      index: true,
    },

    clientId: {
      type: String,
      sparse: true,
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: ["pendingapproval", "approved", "rejected"],
      default: "pendingapproval",
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    approvedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ---------------------- VIRTUAL FIELDS ---------------------- */

/**
 * A virtual field for converting _id to string id
 */
InventorySchema.virtual("id").get(function () {
  return this._id.toHexString();
});

/**
 * Returns true if quantity is 0 or less
 */
InventorySchema.virtual("isLowStock").get(function () {
  return this.quantity <= 0;
});

/**
 * Returns a human-friendly stock status
 * low / normal
 */
InventorySchema.virtual("stockStatus").get(function () {
  if (this.quantity <= 0) return "low";
  return "normal";
});

/* ---------------------- INDEXES ---------------------- */

/* ---------------------- EXPORT MODEL ---------------------- */
export const Inventory = model<InventoryDoc>("Inventory", InventorySchema);
