import { Schema, model, Document, Types } from "mongoose";

export interface InventoryDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  categoryId?: Types.ObjectId;
  quantity: number;
  unit: string;
  price: number;
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

    price: {
      type: Number,
      required: true,
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
// Compound index for faster filtering by client + category
InventorySchema.index({ clientId: 1, categoryId: 1 });

/* ---------------------- EXPORT MODEL ---------------------- */
export const Inventory = model<InventoryDoc>("Inventory", InventorySchema);
