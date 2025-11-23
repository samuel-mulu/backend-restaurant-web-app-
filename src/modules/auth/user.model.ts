import { Schema, model, Document, Types } from "mongoose";
import { Role } from "../../constants/roles";

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  email?: string;
  password: string;
  role: Role;
  phone: string;
  salary?: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["owner", "cashier", "waiter"],
      default: "cashier",
    },
    phone: { type: String, required: true, unique: true, index: true },
    salary: { type: Number, min: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    clientId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

// Compound index for efficient queries
UserSchema.index({ role: 1 });

export const User = model<UserDoc>("User", UserSchema);
