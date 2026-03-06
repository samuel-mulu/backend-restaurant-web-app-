import { Schema, model, Document, Types } from "mongoose";

export interface TableNotificationDoc extends Document {
  tableNumber: number;
  status: "pending" | "cleared";
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TableNotificationSchema = new Schema<TableNotificationDoc>(
  {
    tableNumber: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "cleared"],
      default: "pending",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
    // TTL index: 20 minutes = 1200 seconds
    createdAt: { type: Date, default: Date.now, expires: 1200 },
  },
  { timestamps: true }
);

// Explicitly ensure the TTL index is handled if needed, though 'expires' in schema handles it
TableNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1200 });

export const TableNotification = model<TableNotificationDoc>(
  "TableNotification",
  TableNotificationSchema
);
