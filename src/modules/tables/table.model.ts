import { Schema, model, Document, Types } from "mongoose";

export interface TableDoc extends Document {
  _id: Types.ObjectId;
  tableNumber: string;
  clientId?: string; // offline sync identifier
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<TableDoc>(
  {
    tableNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    clientId: {
      type: String,
      index: true, // NOT unique — safe for offline sync
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_: any, ret: Record<string, any>) => {
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

export const Table = model<TableDoc>("Table", TableSchema);
