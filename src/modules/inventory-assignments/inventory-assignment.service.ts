import mongoose, { Types } from "mongoose";
import { Inventory } from "../inventory/inventory.model";
import { User } from "../auth/user.model";
import { BarmanStockSale } from "./barman-stock-sale.model";
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

const getAvailableOnAssignment = (assignment: {
  remainingQuantity: number;
  committedQuantity?: number;
}) =>
  Math.max(
    0,
    assignment.remainingQuantity - (assignment.committedQuantity || 0)
  );

const findApprovedAssignmentsFifo = (
  inventoryId: string,
  session?: mongoose.ClientSession
) =>
  InventoryAssignment.find({
    inventoryId: new Types.ObjectId(inventoryId),
    status: "approved",
  })
    .sort({ approvedAt: 1, createdAt: 1 })
    .session(session || null);

export const getApprovedRemaining = async (
  inventoryId: string
): Promise<number> => {
  validateObjectId(inventoryId, "Invalid inventory ID");
  const assignments = await findApprovedAssignmentsFifo(inventoryId);
  return assignments.reduce(
    (sum, assignment) => sum + getAvailableOnAssignment(assignment),
    0
  );
};

export const reserveAssignmentRemaining = async (
  inventoryId: string,
  qty: number,
  session?: mongoose.ClientSession
): Promise<void> => {
  validateObjectId(inventoryId, "Invalid inventory ID");
  if (qty <= 0) return;

  const assignments = await findApprovedAssignmentsFifo(inventoryId, session);
  const totalAvailable = assignments.reduce(
    (sum, assignment) => sum + getAvailableOnAssignment(assignment),
    0
  );

  if (totalAvailable < qty) {
    throw {
      status: 400,
      message: `Insufficient approved barman quantity. Available: ${totalAvailable}, Requested: ${qty}`,
    };
  }

  let left = qty;
  for (const assignment of assignments) {
    if (left <= 0) break;
    const available = getAvailableOnAssignment(assignment);
    if (available <= 0) continue;

    const take = Math.min(available, left);
    const updated = await InventoryAssignment.findOneAndUpdate(
      {
        _id: assignment._id,
        remainingQuantity: { $gte: assignment.committedQuantity + take },
      },
      { $inc: { committedQuantity: take } },
      { new: true, session }
    );

    if (!updated) {
      throw {
        status: 400,
        message: "Concurrent update failed while reserving barman stock",
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

export const releaseAssignmentReservation = async (
  inventoryId: string,
  qty: number,
  session?: mongoose.ClientSession
): Promise<void> => {
  validateObjectId(inventoryId, "Invalid inventory ID");
  if (qty <= 0) return;

  const assignments = await InventoryAssignment.find({
    inventoryId: new Types.ObjectId(inventoryId),
    status: "approved",
    committedQuantity: { $gt: 0 },
  })
    .sort({ approvedAt: -1, createdAt: -1 })
    .session(session || null);

  let left = qty;
  for (const assignment of assignments) {
    if (left <= 0) break;
    const release = Math.min(assignment.committedQuantity, left);
    const updated = await InventoryAssignment.findOneAndUpdate(
      {
        _id: assignment._id,
        committedQuantity: { $gte: release },
      },
      { $inc: { committedQuantity: -release } },
      { new: true, session }
    );

    if (!updated) {
      throw {
        status: 400,
        message: "Concurrent update failed while releasing barman reservation",
      };
    }
    left -= release;
  }

  if (left > 0) {
    throw {
      status: 400,
      message: "Could not release full barman reservation amount",
    };
  }
};

export interface SettleOrderInput {
  _id: Types.ObjectId;
  items: Array<{
    itemId: unknown;
    itemModel?: string;
    qty: number;
  }>;
}

export const settleAssignmentSale = async (
  order: SettleOrderInput,
  soldAt: Date,
  session?: mongoose.ClientSession
): Promise<void> => {
  const orderId = order._id;
  const inventoryLines = new Map<string, number>();

  for (const item of order.items) {
    if (item.itemModel !== "Inventory") continue;
    const rawItemId = item.itemId as
      | Types.ObjectId
      | { _id?: Types.ObjectId }
      | string;
    const itemId =
      typeof rawItemId === "object" &&
      rawItemId !== null &&
      "_id" in rawItemId &&
      rawItemId._id
        ? rawItemId._id.toString()
        : String(rawItemId);

    const inventory = await Inventory.findById(itemId).session(session || null);
    if (!inventory?.isBarman) continue;

    inventoryLines.set(itemId, (inventoryLines.get(itemId) || 0) + item.qty);
  }

  for (const [inventoryId, qty] of inventoryLines) {
    const existingSale = await BarmanStockSale.findOne({
      orderId,
      inventoryId: new Types.ObjectId(inventoryId),
    }).session(session || null);

    if (existingSale) continue;

    const assignments = await findApprovedAssignmentsFifo(inventoryId, session);
    let left = qty;

    for (const assignment of assignments) {
      if (left <= 0) break;

      const settleQty = Math.min(left, assignment.remainingQuantity);
      if (settleQty <= 0) continue;

      const commitRelease = Math.min(
        assignment.committedQuantity || 0,
        settleQty
      );

      const updated = await InventoryAssignment.findOneAndUpdate(
        {
          _id: assignment._id,
          remainingQuantity: { $gte: settleQty },
          committedQuantity: { $gte: commitRelease },
        },
        {
          $inc: {
            committedQuantity: -commitRelease,
            remainingQuantity: -settleQty,
          },
        },
        { new: true, session }
      );

      if (!updated) {
        throw {
          status: 400,
          message: "Concurrent update failed while settling barman sale",
        };
      }

      await BarmanStockSale.create(
        [
          {
            barmanId: assignment.barmanId,
            inventoryId: new Types.ObjectId(inventoryId),
            assignmentId: assignment._id,
            orderId,
            qty: settleQty,
            soldAt,
          },
        ],
        { session }
      );

      left -= settleQty;
    }

    if (left > 0) {
      throw {
        status: 400,
        message: `Insufficient barman stock to settle sale. Remaining: ${left}`,
      };
    }
  }
};

export interface DailySummaryFilters {
  date: string;
  barmanId?: string;
  viewerRole?: string;
  viewerId?: string;
}

export interface DailySummaryRow {
  barmanId: string;
  barmanName: string;
  inventoryId: string;
  inventoryName: string;
  unit: string;
  /** Approved quantity on the selected date */
  approved: number;
  /** Sold quantity on the selected date */
  sold: number;
  /**
   * Current left from approved barman stock.
   * Today: live remainingQuantity − committedQuantity.
   * Past dates: approved-through-date − sold-through-date.
   */
  remaining: number;
  /** Qty reserved in open (unpaid) orders — only meaningful for today */
  reserved: number;
}

export interface ApprovalByDateRow {
  /** Civil YYYY-MM-DD in Africa/Addis_Ababa */
  date: string;
  approved: number;
}

export interface ApprovalHistoryRow {
  id: string;
  date: string;
  barmanId: string;
  barmanName: string;
  inventoryId: string;
  inventoryName: string;
  unit: string;
  approved: number;
  assignedById: string;
  assignedByName: string;
}

/** Ethiopia has no DST — always UTC+3 */
const ADDIS_OFFSET = "+03:00";

const getDayBounds = (dateStr: string) => {
  const start = new Date(`${dateStr}T00:00:00.000${ADDIS_OFFSET}`);
  const end = new Date(`${dateStr}T23:59:59.999${ADDIS_OFFSET}`);
  return { start, end };
};

const getAddisToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const isSameAddisDay = (dateStr: string) => dateStr === getAddisToday();

export const getDailySummary = async (
  filters: DailySummaryFilters
): Promise<{
  date: string;
  items: DailySummaryRow[];
  approvalsByDate: ApprovalByDateRow[];
  approvalHistory: ApprovalHistoryRow[];
}> => {
  const { start, end } = getDayBounds(filters.date);

  let barmanFilter: Types.ObjectId | undefined;
  if (filters.viewerRole === "barman" && filters.viewerId) {
    validateObjectId(filters.viewerId, "Invalid barman ID");
    barmanFilter = new Types.ObjectId(filters.viewerId);
  } else if (filters.barmanId) {
    validateObjectId(filters.barmanId, "Invalid barman ID");
    barmanFilter = new Types.ObjectId(filters.barmanId);
  }

  const barmanMatch = barmanFilter ? { barmanId: barmanFilter } : {};

  const approvedAgg = await InventoryAssignment.aggregate([
    {
      $match: {
        status: "approved",
        approvedAt: { $gte: start, $lte: end },
        ...barmanMatch,
      },
    },
    {
      $group: {
        _id: { barmanId: "$barmanId", inventoryId: "$inventoryId" },
        approved: { $sum: "$approvedQuantity" },
      },
    },
  ]);

  const soldAgg = await BarmanStockSale.aggregate([
    {
      $match: {
        soldAt: { $gte: start, $lte: end },
        ...barmanMatch,
      },
    },
    {
      $group: {
        _id: { barmanId: "$barmanId", inventoryId: "$inventoryId" },
        sold: { $sum: "$qty" },
      },
    },
  ]);

  const rowKeys = new Map<
    string,
    { barmanId: Types.ObjectId; inventoryId: Types.ObjectId }
  >();

  for (const row of approvedAgg) {
    const key = `${row._id.barmanId}_${row._id.inventoryId}`;
    rowKeys.set(key, {
      barmanId: row._id.barmanId,
      inventoryId: row._id.inventoryId,
    });
  }
  for (const row of soldAgg) {
    const key = `${row._id.barmanId}_${row._id.inventoryId}`;
    rowKeys.set(key, {
      barmanId: row._id.barmanId,
      inventoryId: row._id.inventoryId,
    });
  }

  // Always show approved barman stock for the selected date (not warehouse).
  // Sold is date-specific; Current is live (today) or end-of-day (past).
  // Include every barman+item that had been approved by end of this day —
  // even if sold that day is 0 (do not hide rows when browsing previous dates).
  const stockAssignments = await InventoryAssignment.find({
    status: "approved",
    approvedAt: { $lte: end },
    ...barmanMatch,
  }).select("barmanId inventoryId");

  for (const assignment of stockAssignments) {
    const key = `${assignment.barmanId}_${assignment.inventoryId}`;
    rowKeys.set(key, {
      barmanId: assignment.barmanId,
      inventoryId: assignment.inventoryId,
    });
  }

  // All approval dates (Addis civil day) for the small approvals history table
  const approvalsByDateAgg = await InventoryAssignment.aggregate([
    {
      $match: {
        status: "approved",
        approvedAt: { $exists: true, $ne: null },
        ...barmanMatch,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$approvedAt",
            timezone: "Africa/Addis_Ababa",
          },
        },
        approved: { $sum: "$approvedQuantity" },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const approvalsByDate: ApprovalByDateRow[] = approvalsByDateAgg.map(
    (row) => ({
      date: row._id as string,
      approved: row.approved as number,
    })
  );

  // Full approval history rows (date + barman + item + cashier)
  const approvedAssignments = await InventoryAssignment.find({
    status: "approved",
    approvedAt: { $exists: true, $ne: null },
    ...barmanMatch,
  })
    .populate("inventoryId", "name unit")
    .populate("barmanId", "name")
    .populate("assignedBy", "name")
    .sort({ approvedAt: -1 })
    .lean();

  const approvalHistory: ApprovalHistoryRow[] = approvedAssignments.map(
    (doc: any) => {
      const approvedAt = doc.approvedAt
        ? new Date(doc.approvedAt)
        : new Date();
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Addis_Ababa",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(approvedAt);

      return {
        id: doc._id.toString(),
        date,
        barmanId:
          doc.barmanId?._id?.toString?.() ||
          doc.barmanId?.toString?.() ||
          "",
        barmanName: doc.barmanId?.name || "Unknown",
        inventoryId:
          doc.inventoryId?._id?.toString?.() ||
          doc.inventoryId?.toString?.() ||
          "",
        inventoryName: doc.inventoryId?.name || "Unknown",
        unit: doc.inventoryId?.unit || "",
        approved: doc.approvedQuantity || 0,
        assignedById:
          doc.assignedBy?._id?.toString?.() ||
          doc.assignedBy?.toString?.() ||
          "",
        assignedByName: doc.assignedBy?.name || "Unknown",
      };
    }
  );

  const approvedMap = new Map(
    approvedAgg.map((row) => [
      `${row._id.barmanId}_${row._id.inventoryId}`,
      row.approved,
    ])
  );
  const soldMap = new Map(
    soldAgg.map((row) => [
      `${row._id.barmanId}_${row._id.inventoryId}`,
      row.sold,
    ])
  );

  const items: DailySummaryRow[] = [];

  for (const [key, ids] of rowKeys) {
    const [barman, inventory] = await Promise.all([
      User.findById(ids.barmanId).select("name").lean(),
      Inventory.findById(ids.inventoryId).select("name unit").lean(),
    ]);

    let remaining = 0;
    let reserved = 0;
    if (isSameAddisDay(filters.date)) {
      const remainingAgg = await InventoryAssignment.aggregate([
        {
          $match: {
            status: "approved",
            barmanId: ids.barmanId,
            inventoryId: ids.inventoryId,
          },
        },
        {
          $group: {
            _id: null,
            remaining: { $sum: "$remainingQuantity" },
            reserved: {
              $sum: { $ifNull: ["$committedQuantity", 0] },
            },
          },
        },
      ]);
      const liveRemaining = remainingAgg[0]?.remaining || 0;
      reserved = remainingAgg[0]?.reserved || 0;
      // Current left available to sell from approved stock
      remaining = Math.max(0, liveRemaining - reserved);
    } else {
      const approvedThrough = await InventoryAssignment.aggregate([
        {
          $match: {
            status: "approved",
            barmanId: ids.barmanId,
            inventoryId: ids.inventoryId,
            approvedAt: { $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$approvedQuantity" },
          },
        },
      ]);
      const soldThrough = await BarmanStockSale.aggregate([
        {
          $match: {
            barmanId: ids.barmanId,
            inventoryId: ids.inventoryId,
            soldAt: { $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$qty" },
          },
        },
      ]);
      remaining = Math.max(
        0,
        (approvedThrough[0]?.total || 0) - (soldThrough[0]?.total || 0)
      );
    }

    items.push({
      barmanId: ids.barmanId.toString(),
      barmanName: (barman as any)?.name || "Unknown",
      inventoryId: ids.inventoryId.toString(),
      inventoryName: (inventory as any)?.name || "Unknown",
      unit: (inventory as any)?.unit || "",
      approved: approvedMap.get(key) || 0,
      sold: soldMap.get(key) || 0,
      remaining,
      reserved,
    });
  }

  items.sort((a, b) => {
    const nameCmp = a.inventoryName.localeCompare(b.inventoryName);
    if (nameCmp !== 0) return nameCmp;
    return a.barmanName.localeCompare(b.barmanName);
  });

  return { date: filters.date, items, approvalsByDate, approvalHistory };
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
