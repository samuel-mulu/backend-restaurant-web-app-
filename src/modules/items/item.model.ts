import { Schema, model, Document, Types, Query } from "mongoose";

export interface ImageInfo {
  url?: string;
  publicId?: string;
}

export interface ItemDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  categoryId: Types.ObjectId;
  category?: any;
  description?: string;
  price: number;
  image?: ImageInfo;
  isAvailable: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  clientId?: string;
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

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },

    description: { type: String, trim: true, maxlength: 500 },

    price: {
      type: Number,
      required: true,
      min: 0,
      get: (v: number): number => v / 100,
      set: (v: number): number => Math.round(v * 100),
    },

    image: {
      url: String,
      publicId: String,
    },

    isAvailable: { type: Boolean, default: true, index: true },

    isDeleted: { type: Boolean, default: false, index: true },

    deletedAt: Date,

    clientId: { type: String, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_: any, ret: Record<string, any>) => {
        delete ret._id;
        delete ret.isDeleted;
        delete ret.deletedAt;
        // Remove categoryId if category is populated
        if (ret.category) {
          delete ret.categoryId;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual for category
ItemSchema.virtual("category", {
  ref: "Category",
  localField: "categoryId",
  foreignField: "_id",
  justOne: true,
});

// Auto-hide deleted
ItemSchema.pre(/^find/, function (next) {
  (this as Query<any, any>).where({ isDeleted: false });
  next();
});

// Full-text search
ItemSchema.index({ name: "text", description: "text" });

// Compound index
ItemSchema.index({ categoryId: 1, isAvailable: 1 });

export const Item = model<ItemDoc>("Item", ItemSchema);
