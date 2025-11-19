import { Schema, model, Document, Types } from "mongoose";

export type OrderStatus = "placed" | "served" | "completed";

interface OrderItem {
  itemId: Schema.Types.ObjectId;
  itemCodeSnapshot: string;
  typeSnapshot: "food" | "beverage";
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
}

export interface OrderDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  orderCode: string;
  orderNumber: string;
  tableNumber: string;
  items: OrderItem[];
  note?: string;
  totalAmount: number;
  status: OrderStatus;
  waiterId?: Schema.Types.ObjectId;
  cashierId?: Schema.Types.ObjectId;
  offlineId?: string;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDoc>(
  {
    orderCode: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    tableNumber: { type: String, required: true },
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
        itemCodeSnapshot: { type: String, required: true },
        typeSnapshot: {
          type: String,
          enum: ["food", "beverage"],
          required: true,
        },
        nameSnapshot: { type: String, required: true },
        priceSnapshot: { type: Number, required: true, min: 0 },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    note: String,
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["placed", "served", "completed"],
      default: "placed",
      index: true,
    },
    waiterId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    offlineId: String,
    clientId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

// Compound indexes for performance
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ waiterId: 1, status: 1 });
orderSchema.index({ cashierId: 1, createdAt: -1 });
orderSchema.index({ tableNumber: 1, status: 1 });

export const Order = model<OrderDoc>("Order", orderSchema);
