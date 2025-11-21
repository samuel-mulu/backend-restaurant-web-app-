import { Schema, model, Document, Types } from "mongoose";

export interface ImageInfo {
  url: string;
  publicId: string;
}

export interface ItemDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  categoryId: Schema.Types.ObjectId;
  category?: any; // Virtual field for populated category
  itemCode: string;
  name: string;
  description?: string;
  price?: number; // store in cents if you prefer: int
  image?: ImageInfo;
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
    name: { type: String, required: true, index: true },
    description: String,
    price: { type: Number, required: false, min: 0 },
    image: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    },
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
ItemSchema.index({ categoryId: 1, isAvailable: 1 });

// Remove the old unique index since itemCode is now the unique identifier
// ItemSchema.index({ categoryId: 1, name: 1 }, { unique: true });

export const Item = model<ItemDoc>("Item", ItemSchema);
