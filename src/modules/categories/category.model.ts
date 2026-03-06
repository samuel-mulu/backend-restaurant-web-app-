import { Schema, model, Document, Types, Query } from "mongoose";

export interface CategoryDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  clientId?: string; // offline sync identifier
  isDeleted: boolean;
  isFavorite: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },

    clientId: {
      type: String,
      index: true, // NOT unique — safe for offline sync
    },

    // Optional: soft delete support
    isDeleted: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_: any, ret: Record<string, any>) => {
        delete ret._id;
        delete ret.isDeleted;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Text search
CategorySchema.index({ name: "text" });

// Auto-hide deleted
CategorySchema.pre(/^find/, function (next) {
  (this as Query<any, any>).where({ isDeleted: false });
  next();
});

export const Category = model<CategoryDoc>("Category", CategorySchema);
