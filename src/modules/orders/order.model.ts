import { Schema, model, Document, Types } from "mongoose";

export type OrderStatus =
  | "OPEN"
  | "VOIDED"
  | "PAID_TO_CASHIER"
  | "TRANSFERRED_TO_OWNER"
  | "OWNER_CONFIRMED"
  | "DISPUTED";

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
  // Chain of custody timestamps
  placedAt: Date;
  cancelledAt?: Date;
  paymentReceivedAt?: Date;
  paymentDeliveredAt?: Date;
  completedAt?: Date;
  // User tracking for status changes
  cancelledBy?: Schema.Types.ObjectId;
  transferredToOwnerBy?: Schema.Types.ObjectId;
  confirmedBy?: Schema.Types.ObjectId;
  disputedBy?: Schema.Types.ObjectId;
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
      enum: [
        "OPEN",
        "VOIDED",
        "PAID_TO_CASHIER",
        "TRANSFERRED_TO_OWNER",
        "OWNER_CONFIRMED",
        "DISPUTED",
      ],
      default: "OPEN",
      index: true,
    },
    // Chain of custody timestamps
    placedAt: { type: Date, required: true },
    cancelledAt: Date,
    paymentReceivedAt: Date,
    paymentDeliveredAt: Date,
    completedAt: Date,
    // User tracking for status changes
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    transferredToOwnerBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    disputedBy: { type: Schema.Types.ObjectId, ref: "User" },
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

// Fix old orderCode index - runs once on first model access
let indexFixAttempted = false;
export async function fixOrderCodeIndex(): Promise<void> {
  if (indexFixAttempted) return;
  indexFixAttempted = true;

  try {
    const collection = Order.collection;
    const indexes = await collection.indexes();
    const orderCodeIndex = indexes.find((idx) => idx.name === "orderCode_1");

    if (orderCodeIndex) {
      console.log("[Order Model] Dropping old orderCode_1 index...");
      await collection.dropIndex("orderCode_1").catch((err: any) => {
        if (err.code !== 27 && err.codeName !== "IndexNotFound") {
          console.error("[Order Model] Error dropping orderCode_1 index:", err);
        }
      });
      console.log("[Order Model] ✓ Fixed orderCode index issue");
    }
  } catch (error: any) {
    // Ignore errors during index cleanup - it's not critical
    if (error.code !== 27 && error.codeName !== "IndexNotFound") {
      console.warn(
        "[Order Model] Warning: Could not check/clean orderCode index:",
        error.message
      );
    }
  }
}

// Auto-fix on model initialization (runs when Order model is first imported)
if (typeof process !== "undefined") {
  // Use setImmediate to ensure mongoose is connected
  setImmediate(() => {
    fixOrderCodeIndex().catch(() => {
      indexFixAttempted = false;
    });
  });
}
