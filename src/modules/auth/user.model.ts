import { Schema, model, Document, Types } from "mongoose";
import { Role } from "../../constants/roles";

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  salary?: number;
  status: "active" | "inactive";
  isActive: boolean;
  clientId?: string;
  // Security fields
  failedLoginCount?: number;
  lockUntil?: Date;
  lastLogin?: Date;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["owner", "cashier", "waiter"],
      default: "cashier",
    },
    phone: { type: String, required: true, unique: true, index: true },
    salary: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    isActive: { type: Boolean, default: true },
    clientId: { type: String, sparse: true, unique: true },
    // Security fields
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
    tokenVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Compound index for efficient queries
UserSchema.index({ role: 1, status: 1 });

export const User = model<UserDoc>("User", UserSchema);
