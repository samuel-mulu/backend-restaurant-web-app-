import { Types } from "mongoose";
import { Expense } from "../expenses/expense.model";
import { Order } from "../orders/order.model";

export type ReportItemType = "ALL" | "menu" | "inventory";

const toItemModel = (
  itemType?: ReportItemType,
): "Item" | "Inventory" | undefined => {
  if (itemType === "menu") return "Item";
  if (itemType === "inventory") return "Inventory";
  return undefined;
};

const lineAmountExpr = {
  $multiply: [
    { $ifNull: ["$items.priceSnapshot", 0] },
    { $ifNull: ["$items.qty", 0] },
  ],
};

// Data validation helper
const validateReportData = (data: any) => {
  const errors: string[] = [];

  if (!data) {
    errors.push("No data returned from aggregation");
    return errors;
  }

  // Validate orders data
  if (!Array.isArray(data.orders)) {
    errors.push("Orders data is not an array");
  }

  // Validate expenses data
  if (!Array.isArray(data.expenses)) {
    errors.push("Expenses data is not an array");
  }

  // Validate sales data
  if (!Array.isArray(data.salesByPaymentMethod)) {
    errors.push("Sales data is not an array");
  }

  // Validate staff performance data
  if (!data.staffPerformance) {
    errors.push("Staff performance data is missing");
  } else {
    if (!Array.isArray(data.staffPerformance.byWaiter)) {
      errors.push("Waiter performance data is not an array");
    }
    if (!Array.isArray(data.staffPerformance.byCashier)) {
      errors.push("Cashier performance data is not an array");
    }
  }

  return errors;
};

const orderLevelFacet: Record<string, object[]> = {
  ordersSummary: [
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        total: { $sum: "$totalAmount" },
      },
    },
  ],
  salesByPaymentMethod: [
    {
      $group: {
        _id: {
          method: { $ifNull: ["$paymentMethod", "unpaid"] },
          bank: { $ifNull: ["$paymentBankName", "-"] },
        },
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ],
  byWaiter: [
    { $match: { waiterId: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$waiterId",
        count: { $sum: 1 },
        total: { $sum: "$totalAmount" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "waiter",
      },
    },
    { $unwind: "$waiter" },
    {
      $project: {
        _id: "$waiter._id",
        name: "$waiter.name",
        count: 1,
        total: 1,
      },
    },
    { $sort: { count: -1 } },
  ],
  byCashier: [
    {
      $group: {
        _id: { $ifNull: ["$cashierId", "$transferredToOwnerBy"] },
        count: { $sum: 1 },
        total: { $sum: "$totalAmount" },
      },
    },
    { $match: { _id: { $ne: null } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "cashier",
      },
    },
    {
      $unwind: {
        path: "$cashier",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: { $ifNull: ["$cashier._id", "$_id"] },
        name: { $ifNull: ["$cashier.name", "Unknown Cashier"] },
        count: 1,
        total: 1,
      },
    },
    { $sort: { count: -1 } },
  ],
};

const lineItemFacet: Record<string, object[]> = {
  ordersSummary: [
    {
      $group: {
        _id: "$status",
        orderIds: { $addToSet: "$_id" },
        total: { $sum: "$lineAmount" },
      },
    },
    {
      $project: {
        _id: 1,
        count: { $size: "$orderIds" },
        total: 1,
      },
    },
  ],
  salesByPaymentMethod: [
    {
      $group: {
        _id: {
          method: { $ifNull: ["$paymentMethod", "unpaid"] },
          bank: { $ifNull: ["$paymentBankName", "-"] },
        },
        orderIds: { $addToSet: "$_id" },
        total: { $sum: "$lineAmount" },
      },
    },
    {
      $project: {
        _id: 1,
        count: { $size: "$orderIds" },
        total: 1,
      },
    },
  ],
  byWaiter: [
    { $match: { waiterId: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$waiterId",
        orderIds: { $addToSet: "$_id" },
        total: { $sum: "$lineAmount" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "waiter",
      },
    },
    { $unwind: "$waiter" },
    {
      $project: {
        _id: "$waiter._id",
        name: "$waiter.name",
        count: { $size: "$orderIds" },
        total: 1,
      },
    },
    { $sort: { count: -1 } },
  ],
  byCashier: [
    {
      $group: {
        _id: { $ifNull: ["$cashierId", "$transferredToOwnerBy"] },
        orderIds: { $addToSet: "$_id" },
        total: { $sum: "$lineAmount" },
      },
    },
    { $match: { _id: { $ne: null } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "cashier",
      },
    },
    {
      $unwind: {
        path: "$cashier",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: { $ifNull: ["$cashier._id", "$_id"] },
        name: { $ifNull: ["$cashier.name", "Unknown Cashier"] },
        count: { $size: "$orderIds" },
        total: 1,
      },
    },
    { $sort: { count: -1 } },
  ],
};

export const getReportData = async (
  startDate: Date,
  endDate: Date,
  statuses?: string[],
  expenseType?: "cash" | "mobile_banking",
  itemType?: ReportItemType,
) => {
  const normalizedStatuses =
    statuses && statuses.length > 0 ? statuses.filter(Boolean) : undefined;

  const matchQuery: any = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  if (normalizedStatuses && normalizedStatuses.length > 0) {
    matchQuery.status = { $in: normalizedStatuses };
  }

  const expenseQuery: any = {
    date: { $gte: startDate, $lte: endDate },
  };

  if (expenseType) {
    if (expenseType === "cash") {
      expenseQuery.$or = [
        { expenseType: { $exists: false } },
        { expenseType: null },
        { expenseType: "cash" },
      ];
    } else {
      expenseQuery.expenseType = expenseType;
    }
  }

  const itemModel = toItemModel(itemType);
  const useLineItems = Boolean(itemModel);

  try {
    const reportPromise = useLineItems
      ? Order.aggregate([
          { $match: matchQuery },
          { $unwind: "$items" },
          { $match: { "items.itemModel": itemModel } },
          { $addFields: { lineAmount: lineAmountExpr } },
          { $facet: lineItemFacet as any },
        ])
      : Order.aggregate([
          { $match: matchQuery },
          { $facet: orderLevelFacet as any },
        ]);

    const expensesPromise = useLineItems
      ? Promise.resolve([])
      : Expense.aggregate([
          { $match: expenseQuery },
          {
            $group: {
              _id: "$reason",
              total: { $sum: "$amount" },
              items: { $push: "$$ROOT" },
            },
          },
        ]);

    const [reportRaw, expenses] = await Promise.all([
      reportPromise,
      expensesPromise,
    ]);

    const result = reportRaw[0] || {
      ordersSummary: [],
      salesByPaymentMethod: [],
      byWaiter: [],
      byCashier: [],
    };
    const reportData = {
      orders: result.ordersSummary,
      expenses,
      salesByPaymentMethod: result.salesByPaymentMethod,
      staffPerformance: {
        byWaiter: result.byWaiter || [],
        byCashier: result.byCashier || [],
      },
    };

    // Validate the data before returning
    const validationErrors = validateReportData(reportData);
    if (validationErrors.length > 0) {
      console.error("Report data validation errors:", validationErrors);
      throw new Error(
        `Report data validation failed: ${validationErrors.join(", ")}`,
      );
    }

    return reportData;
  } catch (error) {
    console.error("Error generating report data:", error);
    throw new Error(
      `Failed to generate report data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export interface StaffOrderDetail {
  _id: string;
  orderNumber: string;
  createdAt: Date;
  status: string;
  paymentMethod?: string;
  totalAmount: number;
  tableNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export const getStaffOrderDetails = async (params: {
  staffType: "waiter" | "cashier";
  staffId: string;
  startDate: Date;
  endDate: Date;
  statuses?: string[];
  paymentMethod?: string;
  itemType?: ReportItemType;
}): Promise<StaffOrderDetail[]> => {
  const {
    staffType,
    staffId,
    startDate,
    endDate,
    statuses,
    paymentMethod,
    itemType,
  } = params;

  const query: any = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  if (statuses && statuses.length > 0) {
    query.status = { $in: statuses };
  }

  if (paymentMethod) {
    if (paymentMethod === "unpaid") {
      query.$or = [
        { paymentMethod: { $exists: false } },
        { paymentMethod: null },
        { paymentMethod: "" },
      ];
    } else {
      query.paymentMethod = paymentMethod;
    }
  }

  const staffObjectId = new Types.ObjectId(staffId);
  if (staffType === "waiter") {
    query.waiterId = staffObjectId;
  } else {
    query.$or = [
      { cashierId: staffObjectId },
      { transferredToOwnerBy: staffObjectId },
    ];
  }

  const itemModel = toItemModel(itemType);

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .select(
      "orderNumber createdAt status paymentMethod totalAmount tableNumber items",
    )
    .lean();

  return orders
    .map((order: any) => {
      const rawItems = Array.isArray(order.items) ? order.items : [];
      const filteredItems = itemModel
        ? rawItems.filter((item: any) => item.itemModel === itemModel)
        : rawItems;

      const totalAmount = itemModel
        ? filteredItems.reduce(
            (sum: number, item: any) =>
              sum + (item.priceSnapshot || 0) * (item.qty || 0),
            0,
          )
        : order.totalAmount || 0;

      return {
        _id: String(order._id),
        orderNumber: order.orderNumber || "",
        createdAt: order.createdAt,
        status: order.status,
        paymentMethod: order.paymentMethod,
        totalAmount,
        tableNumber: order.tableNumber,
        items: filteredItems.map((item: any) => ({
          name: item.nameSnapshot || "Item",
          quantity: item.qty || 0,
          price: item.priceSnapshot || 0,
        })),
      };
    })
    .filter((order) => (itemModel ? order.items.length > 0 : true));
};
