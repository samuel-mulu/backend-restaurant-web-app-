import { Schema, model, Document, Types } from "mongoose";
export type CategoryType = "food" | "beverage";

export interface CategoryDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  type: CategoryType;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    type: {
      type: String,
      enum: ["food", "beverage"],
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    clientId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

CategorySchema.index({ type: 1, name: 1 }, { unique: true });

export const Category = model<CategoryDoc>("Category", CategorySchema);
