import mongoose, { Types } from "mongoose";
import { Inventory } from "../inventory/inventory.model";
import { User } from "../auth/user.model";
import {
  InventoryAssignment,
  InventoryAssignmentDoc,
} from "./inventory-assignment.model";

const validateObjectId = (id: string, message = "Invalid ID") => {
  if (!id) {
    throw { status: 400, message: `${message}: ID is required` };
  }
  if (!Types.ObjectId.isValid(id)) {
    throw { status: 400, message: `${message}: ${id} is not a valid ObjectId` };
  }
};

export interface AssignInventoryInput {
  inventoryId: string;
  barmanId: string;
  assignedQuantity: number;
  assignedBy: string;
}

export interface ListAssignmentsFilters {
  status?: "pending" | "approved" | "rejected";
  inventoryId?: string;
  barmanId?: string;
  viewerRole?: string;
  viewerId?: string;
}

const populateRef = (value: any) => {
  if (!value) return value;
  // Keep populated documents as objects with readable fields
  if (typeof value === "object" && (value.name != null || value._id != null)) {
    const id = value._id?.toString?.() || value.id || undefined;
    return {
      ...value,
      id,
      _id: id,
    };
  }
  return value?.toString?.() || value;
};

const toResponse = (doc: any) => ({
  ...doc,
  id: doc._id?.toString() || doc.id,
  inventoryId: populateRef(doc.inventoryId),
  barmanId: populateRef(doc.barmanId),
  assignedBy: populateRef(doc.assignedBy),
});

export const createAssignment = async (
  data: AssignInventoryInput
): Promise<InventoryAssignmentDoc> => {
  validateObjectId(data.inventoryId, "Invalid inventory ID");
  validateObjectId(data.barmanId, "Invalid barman ID");
  validateObjectId(data.assignedBy, "Invalid assigner ID");

  if (data.assignedQuantity <= 0) {
    throw { status: 400, message: "Assigned quantity must be greater than 0" };
  }

  const inventory = await Inventory.findById(data.inventoryId);
  if (!inventory) {
    throw { status: 404, message: "Inventory item not found" };
  }

  if (!inventory.isBarman) {
    throw {
      status: 400,
      message: "Only barman-flagged inventory items can be assigned",
    };
  }

  if (inventory.quantity < data.assignedQuantity) {
    throw {
      status: 400,
      message: `Insufficient warehouse quantity. Available: ${inventory.quantity}, Requested: ${data.assignedQuantity}`,
    };
  }

  // Pending assignments reserve visibility against warehouse for new assigns
  const pendingReserved = await InventoryAssignment.aggregate([
    {
      $match: {
        inventoryId: inventory._id,
        status: "pending",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$assignedQuantity" },
      },
    },
  ]);
  const reserved = pendingReserved[0]?.total || 0;
  const availableToAssign = inventory.quantity - reserved;
  if (data.assignedQuantity > availableToAssign) {
    throw {
      status: 400,
      message: `Insufficient unassigned quantity. Available to assign: ${availableToAssign}, Requested: ${data.assignedQuantity}`,
    };
  }

  const barman = await User.findOne({
    _id: data.barmanId,
    role: "barman",
    isDeleted: { $ne: true },
  });
  if (!barman) {
    throw { status: 400, message: "Selected user is not an active barman" };
  }

  return InventoryAssignment.create({
    inventoryId: inventory._id,
    barmanId: barman._id,
    assignedBy: new Types.ObjectId(data.assignedBy),
    assignedQuantity: data.assignedQuantity,
    remainingQuantity: 0,
    status: "pending",
  });
};

export const listAssignments = async (filters: ListAssignmentsFilters = {}) => {
  const query: any = {};

  if (filters.status) query.status = filters.status;
  if (filters.inventoryId) {
    validateObjectId(filters.inventoryId, "Invalid inventory ID");
    query.inventoryId = new Types.ObjectId(filters.inventoryId);
  }

  if (filters.viewerRole === "barman" && filters.viewerId) {
    query.barmanId = new Types.ObjectId(filters.viewerId);
  } else if (filters.barmanId) {
    validateObjectId(filters.barmanId, "Invalid barman ID");
    query.barmanId = new Types.ObjectId(filters.barmanId);
  }

  const items = await InventoryAssignment.find(query)
    .populate("inventoryId", "name unit price quantity isBarman")
    .populate("barmanId", "name phone role")
    .populate("assignedBy", "name phone role")
    .sort({ createdAt: -1 })
    .lean();

  return items.map(toResponse);
};

export const approveAssignment = async (
  id: string,
  barmanId: string,
  approvedQuantity: number
): Promise<InventoryAssignmentDoc> => {
  validateObjectId(id, "Invalid assignment ID");
  validateObjectId(barmanId, "Invalid barman ID");

  if (approvedQuantity <= 0) {
    throw { status: 400, message: "Approved quantity must be greater than 0" };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const assignment = await InventoryAssignment.findById(id).session(session);
    if (!assignment) {
      throw { status: 404, message: "Assignment not found" };
    }

    if (assignment.barmanId.toString() !== barmanId) {
      throw { status: 403, message: "You can only approve your own assignments" };
    }

    if (assignment.status !== "pending") {
      throw { status: 400, message: "Only pending assignments can be approved" };
    }

    if (approvedQuantity > assignment.assignedQuantity) {
      throw {
        status: 400,
        message: `Approved quantity cannot exceed assigned quantity (${assignment.assignedQuantity})`,
      };
    }

    const inventory = await Inventory.findOneAndUpdate(
      {
        _id: assignment.inventoryId,
        quantity: { $gte: approvedQuantity },
      },
      { $inc: { quantity: -approvedQuantity } },
      { new: true, session }
    );

    if (!inventory) {
      throw {
        status: 400,
        message: "Insufficient warehouse quantity to approve this assignment",
      };
    }

    assignment.status = "approved";
    assignment.approvedQuantity = approvedQuantity;
    assignment.remainingQuantity = approvedQuantity;
    assignment.approvedAt = new Date();
    await assignment.save({ session });

    await session.commitTransaction();
    return assignment;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const rejectAssignment = async (
  id: string,
  barmanId: string
): Promise<InventoryAssignmentDoc> => {
  validateObjectId(id, "Invalid assignment ID");
  validateObjectId(barmanId, "Invalid barman ID");

  const assignment = await InventoryAssignment.findById(id);
  if (!assignment) {
    throw { status: 404, message: "Assignment not found" };
  }

  if (assignment.barmanId.toString() !== barmanId) {
    throw { status: 403, message: "You can only reject your own assignments" };
  }

  if (assignment.status !== "pending") {
    throw { status: 400, message: "Only pending assignments can be rejected" };
  }

  assignment.status = "rejected";
  assignment.rejectedAt = new Date();
  await assignment.save();
  return assignment;
};

/**
 * FIFO decrement of approved assignment remaining for a barman inventory item.
 * Does not touch warehouse stock.
 */
export const decrementAssignmentRemaining = async (
  inventoryId: string,
  qty: number,
  session?: mongoose.ClientSession
): Promise<void> => {
  validateObjectId(inventoryId, "Invalid inventory ID");
  if (qty <= 0) return;

  const assignments = await InventoryAssignment.find({
    inventoryId: new Types.ObjectId(inventoryId),
    status: "approved",
    remainingQuantity: { $gt: 0 },
  })
    .sort({ approvedAt: 1, createdAt: 1 })
    .session(session || null);

  const totalRemaining = assignments.reduce(
    (sum, a) => sum + a.remainingQuantity,
    0
  );
  if (totalRemaining < qty) {
    throw {
      status: 400,
      message: `Insufficient approved barman quantity. Available: ${totalRemaining}, Requested: ${qty}`,
    };
  }

  let left = qty;
  for (const assignment of assignments) {
    if (left <= 0) break;
    const take = Math.min(assignment.remainingQuantity, left);
    const updated = await InventoryAssignment.findOneAndUpdate(
      {
        _id: assignment._id,
        remainingQuantity: { $gte: take },
      },
      { $inc: { remainingQuantity: -take } },
      { new: true, session }
    );
    if (!updated) {
      throw {
        status: 400,
        message: "Concurrent update failed while deducting barman stock",
      };
    }
    left -= take;
  }

  if (left > 0) {
    throw {
      status: 400,
      message: "Insufficient approved barman quantity after concurrent updates",
    };
  }
};

export const getApprovedRemaining = async (
  inventoryId: string
): Promise<number> => {
  validateObjectId(inventoryId, "Invalid inventory ID");
  const result = await InventoryAssignment.aggregate([
    {
      $match: {
        inventoryId: new Types.ObjectId(inventoryId),
        status: "approved",
        remainingQuantity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$remainingQuantity" },
      },
    },
  ]);
  return result[0]?.total || 0;
};

/**
 * Restore remaining qty to the most recent approved assignment (order edit release).
 */
export const incrementAssignmentRemaining = async (
  inventoryId: string,
  qty: number,
  session?: mongoose.ClientSession
): Promise<void> => {
  validateObjectId(inventoryId, "Invalid inventory ID");
  if (qty <= 0) return;

  const assignment = await InventoryAssignment.findOne({
    inventoryId: new Types.ObjectId(inventoryId),
    status: "approved",
  })
    .sort({ approvedAt: -1, createdAt: -1 })
    .session(session || null);

  if (!assignment) {
    throw {
      status: 400,
      message: "No approved assignment found to restore quantity",
    };
  }

  const maxRestore = assignment.approvedQuantity ?? assignment.remainingQuantity + qty;
  const nextRemaining = Math.min(
    assignment.remainingQuantity + qty,
    maxRestore
  );
  assignment.remainingQuantity = nextRemaining;
  await assignment.save(session ? { session } : undefined);
};
