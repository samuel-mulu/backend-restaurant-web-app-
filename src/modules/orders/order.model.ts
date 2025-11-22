import { Schema, model, Document, Types } from "mongoose";

export type OrderStatus = "ordered" | "paid";

interface OrderItem {
  itemId: Schema.Types.ObjectId;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
}

export interface OrderDoc extends Document {
  _id: Types.ObjectId;
  id: string;
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
    orderNumber: { type: String, required: true, unique: true, index: true },
    tableNumber: { type: String, required: true },
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
        nameSnapshot: { type: String, required: true },
        priceSnapshot: { type: Number, required: true, min: 0 },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    note: String,
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["ordered", "paid"],
      default: "ordered",
      index: true,
    },
    waiterId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    offlineId: String,
    clientId: { type: String, sparse: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_: any, ret: Record<string, any>) => {
        delete ret._id;
        // Remove categoryId from populated items if category is populated
        if (ret.items && Array.isArray(ret.items)) {
          ret.items = ret.items.map((item: any) => {
            if (
              item.itemId &&
              typeof item.itemId === "object" &&
              item.itemId.category
            ) {
              const { categoryId, ...itemRest } = item.itemId;
              return { ...item, itemId: itemRest };
            }
            return item;
          });
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual for id
orderSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Compound indexes for performance
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ waiterId: 1, status: 1 });
orderSchema.index({ cashierId: 1, createdAt: -1 });
orderSchema.index({ tableNumber: 1, status: 1 });

export const Order = model<OrderDoc>("Order", orderSchema);
