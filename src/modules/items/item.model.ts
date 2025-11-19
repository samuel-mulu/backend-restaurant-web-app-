import { Schema, model, Document, Types } from "mongoose";
export type ItemType = "food" | "beverage";

export interface ImageInfo {
  url: string;
  publicId: string;
}

export interface ItemDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  type: ItemType;
  categoryId: Schema.Types.ObjectId;
  category?: any; // Virtual field for populated category
  itemCode: string;
  sku?: string;
  name: string;
  description?: string;
  price?: number; // store in cents if you prefer: int
  images?: ImageInfo[];
  productType: "menu" | "inventory";
  stock?: number;
  unit?: string;
  isAvailable: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  clientId?: string;
  __v?: number; // Version for optimistic concurrency control
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<ItemDoc>(
  {
    type: {
      type: String,
      enum: ["food", "beverage"],
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    itemCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    sku: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, index: true },
    description: String,
    price: { type: Number, required: false, min: 0 },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    productType: {
      type: String,
      enum: ["menu", "inventory"],
      default: "menu",
      index: true,
    },
    stock: { type: Number, min: 0 },
    unit: { type: String },
    isAvailable: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    clientId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual field for fully populated category
ItemSchema.virtual("category", {
  ref: "Category",
  localField: "categoryId",
  foreignField: "_id",
  justOne: true,
});

// Compound indexes for performance
ItemSchema.index({ productType: 1, isAvailable: 1 });
ItemSchema.index({ categoryId: 1, productType: 1 });
ItemSchema.index({ type: 1, categoryId: 1 });

// Remove the old unique index since itemCode is now the unique identifier
// ItemSchema.index({ categoryId: 1, name: 1 }, { unique: true });

export const Item = model<ItemDoc>("Item", ItemSchema);
