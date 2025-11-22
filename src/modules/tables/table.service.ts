import { Types } from "mongoose";
import { Table, TableDoc } from "./table.model";

export class TableServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "SERVICE_ERROR"
  ) {
    super(message);
    Object.setPrototypeOf(this, TableServiceError.prototype);
  }
}

/**
 * Create Table
 */
export const createTable = async (data: {
  tableNumber: string;
  clientId?: string;
}): Promise<TableDoc> => {
  const tableNumber = data.tableNumber.trim().toUpperCase();

  const exists = await Table.findOne({
    tableNumber,
  });

  if (exists) {
    throw new TableServiceError(
      409,
      `Table "${tableNumber}" already exists`,
      "DUPLICATE_TABLE"
    );
  }

  try {
    const table = await Table.create({
      tableNumber,
      clientId: data.clientId,
    });
    return table;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new TableServiceError(
        409,
        "Table number already exists",
        "DUPLICATE_TABLE"
      );
    }
    throw new TableServiceError(500, "Create failed", "CREATE_ERROR");
  }
};

/**
 * List Tables
 */
export const listTables = async (filters?: {
  search?: string;
}): Promise<TableDoc[]> => {
  const query: any = {};

  if (filters?.search) {
    query.tableNumber = { $regex: filters.search, $options: "i" };
  }

  return Table.find(query).sort({ tableNumber: 1 });
};

/**
 * Get Table by ID
 */
export const getTableById = async (id: string): Promise<TableDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new TableServiceError(400, "Invalid ID", "INVALID_ID");
  }

  const table = await Table.findById(id);
  if (!table) {
    throw new TableServiceError(404, "Table not found", "NOT_FOUND");
  }

  return table;
};

/**
 * Get Table by Table Number
 */
export const getTableByNumber = async (
  tableNumber: string
): Promise<TableDoc | null> => {
  const table = await Table.findOne({
    tableNumber: tableNumber.toUpperCase(),
  });

  if (!table) {
    throw new TableServiceError(404, "Table not found", "NOT_FOUND");
  }

  return table;
};

/**
 * Update Table
 */
export const updateTable = async (
  id: string,
  data: Partial<{
    tableNumber: string;
  }>
): Promise<TableDoc | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new TableServiceError(400, "Invalid ID", "INVALID_ID");
  }

  const table = await Table.findById(id);
  if (!table) {
    throw new TableServiceError(404, "Table not found", "NOT_FOUND");
  }

  if (data.tableNumber) {
    const newTableNumber = data.tableNumber.trim().toUpperCase();

    if (newTableNumber !== table.tableNumber) {
      const exists = await Table.findOne({
        _id: { $ne: id },
        tableNumber: newTableNumber,
      });

      if (exists) {
        throw new TableServiceError(
          409,
          `Table "${newTableNumber}" already exists`,
          "DUPLICATE_TABLE"
        );
      }

      table.tableNumber = newTableNumber;
    }
  }

  try {
    await table.save();
    return table;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new TableServiceError(
        409,
        "Duplicate table number",
        "DUPLICATE_TABLE"
      );
    }
    throw new TableServiceError(500, "Update failed", "UPDATE_ERROR");
  }
};

/**
 * Delete Table (Permanent)
 */
export const removeTable = async (id: string): Promise<void> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new TableServiceError(400, "Invalid ID", "INVALID_ID");
  }

  const table = await Table.findByIdAndDelete(id);
  if (!table) {
    throw new TableServiceError(404, "Table not found", "NOT_FOUND");
  }
};
