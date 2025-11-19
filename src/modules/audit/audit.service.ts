import {
  Audit,
  AuditDoc,
  EntityType,
  AuditAction,
  AuditChange,
  AuditMetadata,
} from "./audit.model";
import { Types } from "mongoose";

export interface CreateAuditInput {
  entityType: EntityType;
  entityId: string | Types.ObjectId;
  action: AuditAction;
  performedBy: string | Types.ObjectId;
  changes: AuditChange[];
  metadata?: AuditMetadata;
}

export interface ListAuditFilters {
  entityType?: EntityType;
  entityId?: string;
  performedBy?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export const createAudit = async (
  data: CreateAuditInput
): Promise<AuditDoc> => {
  const audit = await Audit.create({
    entityType: data.entityType,
    entityId: data.entityId,
    action: data.action,
    performedBy: data.performedBy,
    changes: data.changes,
    metadata: data.metadata,
    timestamp: new Date(),
  });

  return audit;
};

export const listAudits = async (filters: ListAuditFilters = {}) => {
  const {
    entityType,
    entityId,
    performedBy,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = filters;

  const query: any = {};

  if (entityType) {
    query.entityType = entityType;
  }

  if (entityId) {
    query.entityId = new Types.ObjectId(entityId);
  }

  if (performedBy) {
    query.performedBy = new Types.ObjectId(performedBy);
  }

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = startDate;
    }
    if (endDate) {
      query.timestamp.$lte = endDate;
    }
  }

  const skip = (page - 1) * limit;

  const [audits, total] = await Promise.all([
    Audit.find(query)
      .populate("performedBy", "name email role")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Audit.countDocuments(query),
  ]);

  return {
    audits,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getAuditsByEntity = async (
  entityType: EntityType,
  entityId: string
) => {
  const audits = await Audit.find({
    entityType,
    entityId: new Types.ObjectId(entityId),
  })
    .populate("performedBy", "name email role")
    .sort({ timestamp: -1 })
    .lean();

  return audits;
};

export const getAuditsByUser = async (userId: string) => {
  const audits = await Audit.find({
    performedBy: new Types.ObjectId(userId),
  })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

  return audits;
};
