import { Schema, model, Document, Types } from "mongoose";

export interface BarmanStockSaleDoc extends Document {
  _id: Types.ObjectId;
  barmanId: Types.ObjectId;
  inventoryId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  orderId: Types.ObjectId;
  qty: number;
  soldAt: Date;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const BarmanStockSaleSchema = new Schema<BarmanStockSaleDoc>(
  {
    barmanId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryAssignment",
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 0.01,
    },
    soldAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BarmanStockSaleSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

BarmanStockSaleSchema.index({ barmanId: 1, soldAt: 1 });
BarmanStockSaleSchema.index({ orderId: 1, inventoryId: 1 });

export const BarmanStockSale = model<BarmanStockSaleDoc>(
  "BarmanStockSale",
  BarmanStockSaleSchema
);
