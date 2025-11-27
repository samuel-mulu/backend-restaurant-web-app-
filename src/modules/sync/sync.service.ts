import { Types } from "mongoose";
import { Order } from "../orders/order.model";
import { Inventory } from "../inventory/inventory.model";
import { Salary } from "../salary/salary.model";
import { User } from "../auth/user.model";
import { Item } from "../items/item.model";
import { Category } from "../categories/category.model";
import { Shift } from "../shifts/shifts.model";
import mongoose from "mongoose";

export type SyncOperationType =
  | "order"
  | "inventory"
  | "salary"
  | "staff"
  | "item"
  | "category"
  | "shift";

export interface SyncOperation {
  type: SyncOperationType;
  clientId: string;
  data: any;
  timestamp: number;
  method: "create" | "update" | "delete";
}

export interface SyncResult {
  synced: Array<{
    clientId: string;
    serverId: string;
    type: SyncOperationType;
  }>;
  conflicts: Array<{ clientId: string; reason: string }>;
  errors: Array<{ clientId: string; error: string }>;
}

/**
 * Process a batch of sync operations atomically
 */
export const processSync = async (
  operations: SyncOperation[],
  performedBy: string
): Promise<SyncResult> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const result: SyncResult = {
    synced: [],
    conflicts: [],
    errors: [],
  };

  try {
    for (const op of operations) {
      try {
        switch (op.type) {
          case "order":
            await syncOrder(op, performedBy, result, session);
            break;
          case "inventory":
            await syncInventory(op, performedBy, result, session);
            break;
          case "salary":
            await syncSalary(op, performedBy, result, session);
            break;
          case "staff":
            await syncStaff(op, performedBy, result, session);
            break;
          case "item":
            await syncItem(op, performedBy, result, session);
            break;
          case "category":
            await syncCategory(op, performedBy, result, session);
            break;
          case "shift":
            await syncShift(op, performedBy, result, session);
            break;
          default:
            result.errors.push({
              clientId: op.clientId,
              error: `Unknown operation type: ${op.type}`,
            });
        }
      } catch (error: any) {
        result.errors.push({
          clientId: op.clientId,
          error: error.message || "Unknown error",
        });
      }
    }

    // Only commit if transaction is still active
    if (session.inTransaction()) {
      await session.commitTransaction();
    }
  } catch (error) {
    // Only abort if transaction is still active
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }

  return result;
};

// Helper functions for each entity type
async function syncOrder(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  // Check if order with clientId already exists
  const existing = await Order.findOne({ clientId: op.clientId }).session(
    session
  );

  if (existing) {
    // If method is update, merge the update data with existing order
    if (op.method === "update") {
      // Only update fields that are provided in op.data
      if (op.data.status !== undefined) {
        existing.status = op.data.status;
      }
      if (op.data.items !== undefined) {
        existing.items = op.data.items.map((item: any) => ({
          itemId: item.itemId,
          nameSnapshot: item.nameSnapshot,
          priceSnapshot: item.priceSnapshot,
          qty: item.qty,
        }));
      }
      if (op.data.totalAmount !== undefined) {
        existing.totalAmount = op.data.totalAmount;
      }
      if (op.data.tableNumber !== undefined) {
        existing.tableNumber = op.data.tableNumber;
      }
      if (op.data.note !== undefined || op.data.notes !== undefined) {
        existing.note = op.data.note || op.data.notes;
      }
      if (op.data.paymentMethod !== undefined) {
        existing.paymentMethod = op.data.paymentMethod;
      }
      if (op.data.paymentProofImage !== undefined) {
        existing.paymentProofImage = op.data.paymentProofImage;
      }

      await existing.save({ session });

      result.synced.push({
        clientId: op.clientId,
        serverId: existing._id.toString(),
        type: "order",
      });
      return;
    }

    // For create method: idempotency - return existing order
    result.synced.push({
      clientId: op.clientId,
      serverId: existing._id.toString(),
      type: "order",
    });
    return;
  }

  // Create new order - ensure all required fields are present
  const orderData: any = {
    ...op.data,
    clientId: op.clientId,
    cashierId: performedBy,
  };

  // Validate required fields
  if (!orderData.orderNumber) {
    throw new Error("Order validation failed: orderNumber is required");
  }
  if (orderData.totalAmount === undefined || orderData.totalAmount === null) {
    throw new Error("Order validation failed: totalAmount is required");
  }
  if (!orderData.placedAt) {
    orderData.placedAt = new Date();
  }

  const order = await Order.create([orderData], { session });

  result.synced.push({
    clientId: op.clientId,
    serverId: order[0]._id.toString(),
    type: "order",
  });
}

async function syncInventory(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  if (op.method === "create") {
    const existing = await Inventory.findOne({ clientId: op.clientId }).session(
      session
    );
    if (existing) {
      result.synced.push({
        clientId: op.clientId,
        serverId: existing._id.toString(),
        type: "inventory",
      });
      return;
    }

    const inventory = await Inventory.create(
      [{ ...op.data, clientId: op.clientId }],
      { session }
    );
    result.synced.push({
      clientId: op.clientId,
      serverId: inventory[0]._id.toString(),
      type: "inventory",
    });
  } else if (op.method === "update") {
    const inventory = await Inventory.findOneAndUpdate(
      { clientId: op.clientId },
      { ...op.data },
      { new: true, session }
    );

    if (inventory) {
      result.synced.push({
        clientId: op.clientId,
        serverId: inventory._id.toString(),
        type: "inventory",
      });
    } else {
      result.errors.push({
        clientId: op.clientId,
        error: "Inventory item not found",
      });
    }
  }
}

async function syncSalary(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  const existing = await Salary.findOne({ clientId: op.clientId }).session(
    session
  );

  if (existing) {
    result.synced.push({
      clientId: op.clientId,
      serverId: existing._id.toString(),
      type: "salary",
    });
    return;
  }

  // Check for duplicate salary (same staff/month/year)
  const duplicate = await Salary.findOne({
    staffId: op.data.staffId,
    month: op.data.month,
    year: op.data.year,
  }).session(session);

  if (duplicate) {
    result.conflicts.push({
      clientId: op.clientId,
      reason: "Duplicate salary for same staff/month/year",
    });
    return;
  }

  const salary = await Salary.create(
    [
      {
        ...op.data,
        clientId: op.clientId,
        createdBy: performedBy,
      },
    ],
    { session }
  );

  result.synced.push({
    clientId: op.clientId,
    serverId: salary[0]._id.toString(),
    type: "salary",
  });
}

async function syncStaff(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  const existing = await User.findOne({ clientId: op.clientId }).session(
    session
  );

  if (existing) {
    result.synced.push({
      clientId: op.clientId,
      serverId: existing._id.toString(),
      type: "staff",
    });
    return;
  }

  // Check for duplicate email or phone
  const duplicateEmail = await User.findOne({ email: op.data.email }).session(
    session
  );
  const duplicatePhone = await User.findOne({ phone: op.data.phone }).session(
    session
  );

  if (duplicateEmail || duplicatePhone) {
    result.conflicts.push({
      clientId: op.clientId,
      reason: "Duplicate email or phone number",
    });
    return;
  }

  const staff = await User.create([{ ...op.data, clientId: op.clientId }], {
    session,
  });
  result.synced.push({
    clientId: op.clientId,
    serverId: staff[0]._id.toString(),
    type: "staff",
  });
}

async function syncItem(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  const existing = await Item.findOne({ clientId: op.clientId }).session(
    session
  );

  if (existing) {
    result.synced.push({
      clientId: op.clientId,
      serverId: existing._id.toString(),
      type: "item",
    });
    return;
  }

  const item = await Item.create([{ ...op.data, clientId: op.clientId }], {
    session,
  });
  result.synced.push({
    clientId: op.clientId,
    serverId: item[0]._id.toString(),
    type: "item",
  });
}

async function syncCategory(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  const existing = await Category.findOne({ clientId: op.clientId }).session(
    session
  );

  if (existing) {
    result.synced.push({
      clientId: op.clientId,
      serverId: existing._id.toString(),
      type: "category",
    });
    return;
  }

  const category = await Category.create(
    [{ ...op.data, clientId: op.clientId }],
    { session }
  );
  result.synced.push({
    clientId: op.clientId,
    serverId: category[0]._id.toString(),
    type: "category",
  });
}

async function syncShift(
  op: SyncOperation,
  performedBy: string,
  result: SyncResult,
  session: mongoose.ClientSession
) {
  const existing = await Shift.findOne({ clientId: op.clientId }).session(
    session
  );

  if (existing) {
    result.synced.push({
      clientId: op.clientId,
      serverId: existing._id.toString(),
      type: "shift",
    });
    return;
  }

  const shift = await Shift.create([{ ...op.data, clientId: op.clientId }], {
    session,
  });
  result.synced.push({
    clientId: op.clientId,
    serverId: shift[0]._id.toString(),
    type: "shift",
  });
}
