import { Order } from "../orders/order.model";
import { User } from "../auth/user.model";
import { Inventory } from "../inventory/inventory.model";
import { Types } from "mongoose";

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

export interface DashboardStats {
  totalSales: {
    today: number;
    week: number;
    month: number;
  };
  totalOrders: {
    today: number;
    week: number;
    month: number;
  };
  activeStaffCount: number;
  lowStockItemsCount: number;
}

export const getDashboardStats = async (
  dateRange?: DateRange
): Promise<DashboardStats> => {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // Total sales
  const [todaySales, weekSales, monthSales] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: "paid",
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo },
          status: "paid",
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: monthAgo },
          status: "paid",
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  // Total orders
  const [todayOrders, weekOrders, monthOrders] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.countDocuments({ createdAt: { $gte: weekAgo } }),
    Order.countDocuments({ createdAt: { $gte: monthAgo } }),
  ]);

  // Active staff count
  const activeStaffCount = await User.countDocuments({
    status: "active",
    role: { $in: ["cashier", "waiter"] },
  });

  // Low stock items count
  const lowStockItemsCount = await Inventory.countDocuments({
    $expr: { $lt: ["$quantity", { $ifNull: ["$minThreshold", 0] }] },
  });

  return {
    totalSales: {
      today: todaySales[0]?.total || 0,
      week: weekSales[0]?.total || 0,
      month: monthSales[0]?.total || 0,
    },
    totalOrders: {
      today: todayOrders,
      week: weekOrders,
      month: monthOrders,
    },
    activeStaffCount,
    lowStockItemsCount,
  };
};

export interface SalesAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  cashierId?: string;
}

export interface SalesAnalytics {
  salesByDay: Array<{ date: string; total: number; count: number }>;
  salesByCashier: Array<{
    cashierId: string;
    cashierName: string;
    total: number;
    count: number;
  }>;
  trends: Array<{ date: string; total: number }>;
}

export const getSalesAnalytics = async (
  filters: SalesAnalyticsFilters = {}
): Promise<SalesAnalytics> => {
  const matchQuery: any = {
    status: "paid",
  };

  if (filters.startDate || filters.endDate) {
    matchQuery.createdAt = {};
    if (filters.startDate) {
      matchQuery.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchQuery.createdAt.$lte = filters.endDate;
    }
  }

  if (filters.cashierId) {
    matchQuery.cashierId = new Types.ObjectId(filters.cashierId);
  }

  // Sales by day
  const salesByDay = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: "$_id",
        total: 1,
        count: 1,
        _id: 0,
      },
    },
  ]);

  // Sales by cashier
  const salesByCashier = await Order.aggregate([
    { $match: { ...matchQuery, cashierId: { $exists: true } } },
    {
      $group: {
        _id: "$cashierId",
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "cashier",
      },
    },
    { $unwind: "$cashier" },
    {
      $project: {
        cashierId: "$_id",
        cashierName: "$cashier.name",
        total: 1,
        count: 1,
        _id: 0,
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Trends (time series)
  const trends = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: "$_id",
        total: 1,
        _id: 0,
      },
    },
  ]);

  return {
    salesByDay,
    salesByCashier,
    trends,
  };
};

export interface ProductAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ProductAnalytics {
  bestSellingItems: Array<{
    itemId: string;
    itemName: string;
    totalQty: number;
    revenue: number;
  }>;
  revenueByProduct: Array<{
    itemId: string;
    itemName: string;
    revenue: number;
  }>;
  productPerformance: Array<{
    itemId: string;
    itemName: string;
    date: string;
    qty: number;
    revenue: number;
  }>;
}

export const getProductAnalytics = async (
  filters: ProductAnalyticsFilters = {}
): Promise<ProductAnalytics> => {
  const matchQuery: any = {
    status: "paid",
  };

  if (filters.startDate || filters.endDate) {
    matchQuery.createdAt = {};
    if (filters.startDate) {
      matchQuery.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchQuery.createdAt.$lte = filters.endDate;
    }
  }

  const limit = filters.limit || 10;

  // Best selling items
  const bestSellingItems = await Order.aggregate([
    { $match: matchQuery },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.itemId",
        itemName: { $first: "$items.nameSnapshot" },
        totalQty: { $sum: "$items.qty" },
        revenue: {
          $sum: { $multiply: ["$items.priceSnapshot", "$items.qty"] },
        },
      },
    },
    { $sort: { totalQty: -1 } },
    { $limit: limit },
    {
      $project: {
        itemId: "$_id",
        itemName: 1,
        totalQty: 1,
        revenue: 1,
        _id: 0,
      },
    },
  ]);

  // Revenue by product
  const revenueByProduct = await Order.aggregate([
    { $match: matchQuery },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.itemId",
        itemName: { $first: "$items.nameSnapshot" },
        revenue: {
          $sum: { $multiply: ["$items.priceSnapshot", "$items.qty"] },
        },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    {
      $project: {
        itemId: "$_id",
        itemName: 1,
        revenue: 1,
        _id: 0,
      },
    },
  ]);

  // Product performance over time
  const productPerformance = await Order.aggregate([
    { $match: matchQuery },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          itemId: "$items.itemId",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        itemName: { $first: "$items.nameSnapshot" },
        qty: { $sum: "$items.qty" },
        revenue: {
          $sum: { $multiply: ["$items.priceSnapshot", "$items.qty"] },
        },
      },
    },
    { $sort: { "_id.date": 1, revenue: -1 } },
    {
      $project: {
        itemId: "$_id.itemId",
        itemName: 1,
        date: "$_id.date",
        qty: 1,
        revenue: 1,
        _id: 0,
      },
    },
  ]);

  return {
    bestSellingItems,
    revenueByProduct,
    productPerformance,
  };
};

export interface StaffPerformanceFilters {
  startDate?: Date;
  endDate?: Date;
}

export interface StaffPerformance {
  ordersByWaiter: Array<{
    waiterId: string;
    waiterName: string;
    orderCount: number;
    avgOrderValue: number;
  }>;
  ordersByCashier: Array<{
    cashierId: string;
    cashierName: string;
    orderCount: number;
    totalRevenue: number;
    avgOrderValue: number;
  }>;
  performanceMetrics: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    ordersPerDay: number;
  };
}

export const getStaffPerformance = async (
  filters: StaffPerformanceFilters = {}
): Promise<StaffPerformance> => {
  const matchQuery: any = {};

  if (filters.startDate || filters.endDate) {
    matchQuery.createdAt = {};
    if (filters.startDate) {
      matchQuery.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchQuery.createdAt.$lte = filters.endDate;
    }
  }

  // Orders by waiter
  const ordersByWaiter = await Order.aggregate([
    { $match: { ...matchQuery, waiterId: { $exists: true } } },
    {
      $group: {
        _id: "$waiterId",
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: "$totalAmount" },
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
        waiterId: "$_id",
        waiterName: "$waiter.name",
        orderCount: 1,
        avgOrderValue: 1,
        _id: 0,
      },
    },
    { $sort: { orderCount: -1 } },
  ]);

  // Orders by cashier
  const ordersByCashier = await Order.aggregate([
    { $match: { ...matchQuery, cashierId: { $exists: true } } },
    {
      $group: {
        _id: "$cashierId",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "cashier",
      },
    },
    { $unwind: "$cashier" },
    {
      $project: {
        cashierId: "$_id",
        cashierName: "$cashier.name",
        orderCount: 1,
        totalRevenue: 1,
        avgOrderValue: 1,
        _id: 0,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  // Performance metrics
  const metrics = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
  ]);

  const daysDiff =
    filters.startDate && filters.endDate
      ? Math.ceil(
          (filters.endDate.getTime() - filters.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
        ) || 1
      : 1;

  const performanceMetrics = {
    totalOrders: metrics[0]?.totalOrders || 0,
    totalRevenue: metrics[0]?.totalRevenue || 0,
    avgOrderValue: metrics[0]?.avgOrderValue || 0,
    ordersPerDay: (metrics[0]?.totalOrders || 0) / daysDiff,
  };

  return {
    ordersByWaiter,
    ordersByCashier,
    performanceMetrics,
  };
};

export interface InventoryAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
}

export interface InventoryAnalytics {
  stockLevels: Array<{
    inventoryId: string;
    inventoryName: string;
    date: string;
    quantity: number;
  }>;
}

export const getInventoryAnalytics = async (
  filters: InventoryAnalyticsFilters = {}
): Promise<InventoryAnalytics> => {
  // Stock levels over time (simplified - would need historical tracking for accurate data)
  const stockLevels = await Inventory.aggregate([
    {
      $project: {
        inventoryId: { $toString: "$_id" },
        inventoryName: "$name",
        date: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
        quantity: 1,
        _id: 0,
      },
    },
  ]);

  return {
    stockLevels,
  };
};
