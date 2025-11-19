import { Schema, model, Document, Types } from "mongoose";

export type EntityType =
  | "order"
  | "salary"
  | "inventory"
  | "staff"
  | "item"
  | "category";
export type AuditAction = "create" | "update" | "delete" | "status_change";

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  clientId?: string;
}

export interface AuditDoc extends Document {
  _id: Types.ObjectId;
  id: string;
  entityType: EntityType;
  entityId: Types.ObjectId;
  action: AuditAction;
  performedBy: Types.ObjectId;
  changes: AuditChange[];
  metadata?: AuditMetadata;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuditSchema = new Schema<AuditDoc>(
  {
    entityType: {
      type: String,
      enum: ["order", "salary", "inventory", "staff", "item", "category"],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["create", "update", "delete", "status_change"],
      required: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    changes: [
      {
        field: { type: String, required: true },
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
      },
    ],
    metadata: {
      ipAddress: String,
      userAgent: String,
      clientId: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
AuditSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditSchema.index({ performedBy: 1, timestamp: -1 });

export const Audit = model<AuditDoc>("Audit", AuditSchema);
