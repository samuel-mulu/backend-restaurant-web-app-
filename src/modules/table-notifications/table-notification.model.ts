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

// TTL index: 20 minutes handled by 'expires' field above

export const TableNotification = model<TableNotificationDoc>(
  "TableNotification",
  TableNotificationSchema
);
