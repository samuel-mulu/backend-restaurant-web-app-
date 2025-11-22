import { Schema, model, Document, Types } from "mongoose";

export interface InventoryDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  categoryId?: Types.ObjectId;
  quantity: number;
  unit: string;
  minThreshold?: number;
  clientId?: string;

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

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
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

    minThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },

    clientId: {
      type: String,
      sparse: true,
      index: true,
    },
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
 * Returns true if quantity <= minThreshold
 */
InventorySchema.virtual("isLowStock").get(function () {
  return this.quantity <= (this.minThreshold ?? 0);
});

/**
 * Returns a human-friendly stock status
 * low / normal / overstock
 */
InventorySchema.virtual("stockStatus").get(function () {
  const threshold = this.minThreshold ?? 0;
  if (this.quantity <= threshold) return "low";
  return "normal";
});

/* ---------------------- INDEXES ---------------------- */
// Compound index for faster filtering by client + category
InventorySchema.index({ clientId: 1, categoryId: 1 });

/* ---------------------- EXPORT MODEL ---------------------- */
export const Inventory = model<InventoryDoc>("Inventory", InventorySchema);
