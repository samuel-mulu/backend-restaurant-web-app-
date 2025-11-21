import { Schema, model, Document, Types } from "mongoose";

export interface CategoryDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  clientId: string;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, unique: true },
    clientId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

export const Category = model<CategoryDoc>("Category", CategorySchema);
