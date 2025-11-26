import { Schema, model, Document, Types } from "mongoose";

export interface NotificationDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "order" | "system" | "alert";
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDoc>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["order", "system", "alert"],
      default: "order",
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = model<NotificationDoc>(
  "Notification",
  NotificationSchema
);
