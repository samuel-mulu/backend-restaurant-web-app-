import { Schema, model, Document, Types, Query } from "mongoose";

export interface ImageInfo {
  url?: string;
  publicId?: string;
}

export interface ItemDoc extends Document {
  _id: Types.ObjectId;
  id: string; // virtual
  name: string;
  categoryId: Types.ObjectId;
  category?: any;
  description?: string;
  price: number;
  image?: ImageInfo;
  isAvailable: boolean;
  isDeleted: boolean;
  isFavorite: boolean;
  deletedAt?: Date;
  clientId?: string;
  approvalStatus: "pendingapproval" | "approved" | "rejected";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  ingredients?: string[];
  mealType?: "breakfast" | "lunch" | "dinner" | "treats";
  comments?: string[];
  special?: boolean;
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
    },

    image: {
      url: String,
      publicId: String,
    },

    isAvailable: { type: Boolean, default: true, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    isFavorite: { type: Boolean, default: false, index: true },
    deletedAt: Date,

    clientId: { type: String, index: true },

    approvalStatus: {
      type: String,
      enum: ["pendingapproval", "approved", "rejected"],
      default: "pendingapproval",
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    approvedAt: Date,

    ingredients: [{ type: String, trim: true }],

    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "treats"],
      index: true,
    },

    comments: [{ type: String, trim: true }],

    special: { type: Boolean, default: false, index: true },
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
        // Remove categoryId if category is populated and convert category _id to id
        if (ret.category) {
          delete ret.categoryId;
          // Convert category _id to id
          if (ret.category._id) {
            ret.category.id = ret.category._id.toString();
            delete ret.category._id;
          }
          // Remove category internal fields
          delete ret.category.isDeleted;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual for id (convert _id to string id)
ItemSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

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
