import { createAudit, CreateAuditInput } from "../../modules/audit/audit.service";
import { Request } from "express";

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

/**
 * Helper function to create audit logs
 */
export const logAudit = async (
  entityType: CreateAuditInput["entityType"],
  entityId: string,
  action: CreateAuditInput["action"],
  performedBy: string,
  changes: AuditChange[],
  req?: Request
) => {
  try {
    const metadata = req
      ? {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
          clientId: req.body?.clientId,
        }
      : undefined;

    await createAudit({
      entityType,
      entityId,
      action,
      performedBy,
      changes,
      metadata,
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error("Failed to create audit log:", error);
  }
};

/**
 * Helper to create audit log for create operations
 */
export const logCreate = async (
  entityType: CreateAuditInput["entityType"],
  entityId: string,
  performedBy: string,
  newData: Record<string, any>,
  req?: Request
) => {
  const changes = Object.entries(newData).map(([field, value]) => ({
    field,
    oldValue: null,
    newValue: value,
  }));

  await logAudit(entityType, entityId, "create", performedBy, changes, req);
};

/**
 * Helper to create audit log for update operations
 */
export const logUpdate = async (
  entityType: CreateAuditInput["entityType"],
  entityId: string,
  performedBy: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  req?: Request
) => {
  const changes: AuditChange[] = [];

  for (const [field, newValue] of Object.entries(newData)) {
    const oldValue = oldData[field];
    if (oldValue !== newValue) {
      changes.push({
        field,
        oldValue,
        newValue,
      });
    }
  }

  if (changes.length > 0) {
    await logAudit(entityType, entityId, "update", performedBy, changes, req);
  }
};

/**
 * Helper to create audit log for delete operations
 */
export const logDelete = async (
  entityType: CreateAuditInput["entityType"],
  entityId: string,
  performedBy: string,
  deletedData: Record<string, any>,
  req?: Request
) => {
  const changes = Object.entries(deletedData).map(([field, value]) => ({
    field,
    oldValue: value,
    newValue: null,
  }));

  await logAudit(entityType, entityId, "delete", performedBy, changes, req);
};

/**
 * Helper to create audit log for status changes
 */
export const logStatusChange = async (
  entityType: CreateAuditInput["entityType"],
  entityId: string,
  performedBy: string,
  oldStatus: string,
  newStatus: string,
  req?: Request
) => {
  await logAudit(
    entityType,
    entityId,
    "status_change",
    performedBy,
    [
      {
        field: "status",
        oldValue: oldStatus,
        newValue: newStatus,
      },
    ],
    req
  );
};

