import { Schema, model, Document, Types } from "mongoose";

export interface PurchaseRecord {
  quantity: number;
  purchaseDate: Date;
  cost: number;
  purchasedBy: Types.ObjectId;
}

export interface InventoryDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  productId: Types.ObjectId;
  quantity: number;
  unit: string;
  minThreshold?: number;
  lastPurchaseDate?: Date;
  purchaseHistory: PurchaseRecord[];
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<InventoryDoc>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      unique: true,
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
    },
    minThreshold: {
      type: Number,
      min: 0,
    },
    lastPurchaseDate: {
      type: Date,
    },
    purchaseHistory: [
      {
        quantity: { type: Number, required: true, min: 0 },
        purchaseDate: { type: Date, required: true },
        cost: { type: Number, required: true, min: 0 },
        purchasedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    clientId: { type: String, sparse: true },
  },
  { timestamps: true }
);

// Indexes for performance
InventorySchema.index({ "purchaseHistory.purchaseDate": -1 });

export const Inventory = model<InventoryDoc>("Inventory", InventorySchema);
