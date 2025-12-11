import { Order } from "../orders/order.model";
import { User } from "../auth/user.model";
import { Inventory } from "../inventory/inventory.model";
import { Item } from "../items/item.model";
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
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: monthAgo },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
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
  revenueTrend: Array<{ date: string; total: number; count: number }>;
  paymentMethodBreakdown: Array<{
    method: string;
    total: number;
    count: number;
  }>;
  revenueComparison: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
  };
}

export const getSalesAnalytics = async (
  filters: SalesAnalyticsFilters = {}
): Promise<SalesAnalytics> => {
  const matchQuery: any = {
    status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
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

  // Payment method breakdown
  const paymentMethodBreakdown = await Order.aggregate([
    { $match: { ...matchQuery, paymentMethod: { $exists: true } } },
    {
      $group: {
        _id: "$paymentMethod",
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        method: "$_id",
        total: 1,
        count: 1,
        _id: 0,
      },
    },
  ]);

  // Revenue comparison
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  );
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const [
    todayRevenue,
    yesterdayRevenue,
    thisWeekRevenue,
    lastWeekRevenue,
    thisMonthRevenue,
    lastMonthRevenue,
  ] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: yesterday, $lt: today },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thisWeekStart },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonthStart },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  return {
    salesByDay,
    salesByCashier,
    trends,
    revenueTrend: salesByDay,
    paymentMethodBreakdown,
    revenueComparison: {
      today: todayRevenue[0]?.total || 0,
      yesterday: yesterdayRevenue[0]?.total || 0,
      thisWeek: thisWeekRevenue[0]?.total || 0,
      lastWeek: lastWeekRevenue[0]?.total || 0,
      thisMonth: thisMonthRevenue[0]?.total || 0,
      lastMonth: lastMonthRevenue[0]?.total || 0,
    },
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
  revenueByCategory: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    itemCount: number;
  }>;
}

export const getProductAnalytics = async (
  filters: ProductAnalyticsFilters = {}
): Promise<ProductAnalytics> => {
  const matchQuery: any = {
    status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
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
        itemId: { $toString: "$_id" },
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
        itemId: { $toString: "$_id" },
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
        itemId: { $toString: "$_id.itemId" },
        itemName: 1,
        date: "$_id.date",
        qty: 1,
        revenue: 1,
        _id: 0,
      },
    },
  ]);

  // Revenue by category
  const revenueByCategory = await Order.aggregate([
    { $match: matchQuery },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "items",
        localField: "items.itemId",
        foreignField: "_id",
        as: "itemDetails",
      },
    },
    { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "itemDetails.categoryId",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$itemDetails.categoryId",
        categoryName: { $first: "$categoryDetails.name" },
        revenue: {
          $sum: { $multiply: ["$items.priceSnapshot", "$items.qty"] },
        },
        itemCount: { $addToSet: "$items.itemId" },
      },
    },
    {
      $project: {
        categoryId: { $toString: "$_id" },
        categoryName: { $ifNull: ["$categoryName", "Uncategorized"] },
        revenue: 1,
        itemCount: { $size: "$itemCount" },
        _id: 0,
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  return {
    bestSellingItems,
    revenueByProduct,
    productPerformance,
    revenueByCategory,
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
  topSelling: Array<{
    inventoryId: string;
    inventoryName: string;
    quantity: number;
    value: number;
  }>;
  lowStockItems: Array<{
    inventoryId: string;
    inventoryName: string;
    quantity: number;
    unit: string;
  }>;
  inventoryValue: number;
  totalItems: number;
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

  // Get all inventory items with their current state
  const allInventory = await Inventory.find({}).lean();

  // Low stock items (quantity <= 0)
  const lowStockItems = allInventory
    .filter((inv) => inv.quantity <= 0)
    .map((inv) => ({
      inventoryId: inv._id.toString(),
      inventoryName: inv.name,
      quantity: inv.quantity,
      unit: inv.unit,
    }));

  // Top selling inventory (by quantity - for now, we'll use current quantity as a proxy)
  // In a real system, you'd track consumption through orders
  const topSelling = allInventory
    .map((inv) => ({
      inventoryId: inv._id.toString(),
      inventoryName: inv.name,
      quantity: inv.quantity,
      value: inv.quantity * inv.price,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Total inventory value
  const inventoryValue = allInventory.reduce(
    (sum, inv) => sum + inv.quantity * inv.price,
    0
  );

  return {
    stockLevels,
    topSelling,
    lowStockItems,
    inventoryValue,
    totalItems: allInventory.length,
  };
};

// Order Analytics
export interface OrderAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
}

export interface OrderAnalytics {
  orderVolumeTrend: Array<{ date: string; count: number; total: number }>;
  averageOrderValue: number;
  ordersByStatus: {
    OPEN: number;
    VOIDED: number;
    PAID_TO_CASHIER: number;
    TRANSFERRED_TO_OWNER: number;
    OWNER_CONFIRMED: number;
    DISPUTED: number;
  };
  peakHours: Array<{ hour: number; count: number }>;
}

export const getOrderAnalytics = async (
  filters: OrderAnalyticsFilters = {}
): Promise<OrderAnalytics> => {
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

  // Order volume trend
  const orderVolumeTrend = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        total: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: "$_id",
        count: 1,
        total: 1,
        _id: 0,
      },
    },
  ]);

  // Orders by status
  const ordersByStatus = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const statusMap: Record<string, number> = {
    OPEN: 0,
    VOIDED: 0,
    PAID_TO_CASHIER: 0,
    TRANSFERRED_TO_OWNER: 0,
    OWNER_CONFIRMED: 0,
    DISPUTED: 0,
  };

  ordersByStatus.forEach((item) => {
    statusMap[item._id] = item.count;
  });

  // Average order value
  const avgOrderValueResult = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        avgValue: { $avg: "$totalAmount" },
      },
    },
  ]);

  // Peak hours
  const peakHours = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $hour: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    {
      $project: {
        hour: "$_id",
        count: 1,
        _id: 0,
      },
    },
  ]);

  return {
    orderVolumeTrend,
    averageOrderValue: avgOrderValueResult[0]?.avgValue || 0,
    ordersByStatus: statusMap,
    peakHours,
  };
};

// Comprehensive Analytics
export interface ComprehensiveAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
}

export interface TableAnalytics {
  salesByTable: Array<{
    tableNumber: string;
    orderCount: number;
    totalRevenue: number;
    avgOrderValue: number;
  }>;
  topTables: Array<{
    tableNumber: string;
    totalRevenue: number;
    orderCount: number;
  }>;
}

export interface TimingAnalytics {
  averageOrderCompletionTime: number; // in minutes
  averagePaymentTime: number; // in minutes
  averageTimeToCashier: number; // in minutes
  orderTimingDistribution: Array<{
    timeRange: string;
    count: number;
  }>;
}

export interface DayOfWeekAnalytics {
  salesByDayOfWeek: Array<{
    dayOfWeek: string;
    dayNumber: number;
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
  }>;
}

export interface VoidAnalytics {
  voidedOrdersCount: number;
  voidedOrdersRevenue: number;
  voidRate: number; // percentage
  voidedOrdersByReason?: Array<{
    reason?: string;
    count: number;
    revenue: number;
  }>;
}

export interface ComprehensiveAnalytics {
  cashFlow: SalesAnalytics;
  inventory: InventoryAnalytics;
  menu: ProductAnalytics;
  orders: OrderAnalytics;
  staff: StaffPerformance;
  tables: TableAnalytics;
  timing: TimingAnalytics;
  dayOfWeek: DayOfWeekAnalytics;
  voids: VoidAnalytics;
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    lowStockItemsCount: number;
    activeStaffCount: number;
    voidedOrdersCount: number;
    averageOrderCompletionTime: number;
    topSellingCategory: string;
    busiestDay: string;
    busiestHour: number;
  };
}

const getTableAnalytics = async (
  filters: ComprehensiveAnalyticsFilters = {}
): Promise<TableAnalytics> => {
  const matchQuery: any = {
    status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
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

  // Sales by table
  const salesByTable = await Order.aggregate([
    { $match: { ...matchQuery, tableNumber: { $exists: true, $ne: "" } } },
    {
      $group: {
        _id: "$tableNumber",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
    {
      $project: {
        tableNumber: "$_id",
        orderCount: 1,
        totalRevenue: 1,
        avgOrderValue: 1,
        _id: 0,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  // Top tables
  const topTables = salesByTable.slice(0, 10);

  return {
    salesByTable,
    topTables,
  };
};

const getTimingAnalytics = async (
  filters: ComprehensiveAnalyticsFilters = {}
): Promise<TimingAnalytics> => {
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

  // Get orders with timing data
  const ordersWithTiming = await Order.find({
    ...matchQuery,
    completedAt: { $exists: true },
    placedAt: { $exists: true },
  }).lean();

  // Calculate average completion time
  let totalCompletionTime = 0;
  let completionCount = 0;

  ordersWithTiming.forEach((order) => {
    if (order.completedAt && order.placedAt) {
      const timeDiff =
        (new Date(order.completedAt).getTime() -
          new Date(order.placedAt).getTime()) /
        (1000 * 60); // Convert to minutes
      if (timeDiff > 0) {
        totalCompletionTime += timeDiff;
        completionCount++;
      }
    }
  });

  const averageOrderCompletionTime =
    completionCount > 0 ? totalCompletionTime / completionCount : 0;

  // Calculate average payment time
  const ordersWithPayment = await Order.find({
    ...matchQuery,
    paymentReceivedAt: { $exists: true },
    placedAt: { $exists: true },
  }).lean();

  let totalPaymentTime = 0;
  let paymentCount = 0;

  ordersWithPayment.forEach((order) => {
    if (order.paymentReceivedAt && order.placedAt) {
      const timeDiff =
        (new Date(order.paymentReceivedAt).getTime() -
          new Date(order.placedAt).getTime()) /
        (1000 * 60);
      if (timeDiff > 0) {
        totalPaymentTime += timeDiff;
        paymentCount++;
      }
    }
  });

  const averagePaymentTime =
    paymentCount > 0 ? totalPaymentTime / paymentCount : 0;

  // Calculate average time to cashier
  const ordersToCashier = await Order.find({
    ...matchQuery,
    paymentDeliveredAt: { $exists: true },
    paymentReceivedAt: { $exists: true },
  }).lean();

  let totalCashierTime = 0;
  let cashierCount = 0;

  ordersToCashier.forEach((order) => {
    if (order.paymentDeliveredAt && order.paymentReceivedAt) {
      const timeDiff =
        (new Date(order.paymentDeliveredAt).getTime() -
          new Date(order.paymentReceivedAt).getTime()) /
        (1000 * 60);
      if (timeDiff > 0) {
        totalCashierTime += timeDiff;
        cashierCount++;
      }
    }
  });

  const averageTimeToCashier =
    cashierCount > 0 ? totalCashierTime / cashierCount : 0;

  // Order timing distribution (buckets: 0-15min, 15-30min, 30-60min, 60+min)
  const timingBuckets = {
    "0-15": 0,
    "15-30": 0,
    "30-60": 0,
    "60+": 0,
  };

  ordersWithTiming.forEach((order) => {
    if (order.completedAt && order.placedAt) {
      const timeDiff =
        (new Date(order.completedAt).getTime() -
          new Date(order.placedAt).getTime()) /
        (1000 * 60);
      if (timeDiff <= 15) {
        timingBuckets["0-15"]++;
      } else if (timeDiff <= 30) {
        timingBuckets["15-30"]++;
      } else if (timeDiff <= 60) {
        timingBuckets["30-60"]++;
      } else {
        timingBuckets["60+"]++;
      }
    }
  });

  const orderTimingDistribution = Object.entries(timingBuckets).map(
    ([timeRange, count]) => ({
      timeRange: `${timeRange} min`,
      count,
    })
  );

  return {
    averageOrderCompletionTime: Math.round(averageOrderCompletionTime * 10) / 10,
    averagePaymentTime: Math.round(averagePaymentTime * 10) / 10,
    averageTimeToCashier: Math.round(averageTimeToCashier * 10) / 10,
    orderTimingDistribution,
  };
};

const getDayOfWeekAnalytics = async (
  filters: ComprehensiveAnalyticsFilters = {}
): Promise<DayOfWeekAnalytics> => {
  const matchQuery: any = {
    status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
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

  const salesByDayOfWeek = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dayOfWeek: "$createdAt" },
        totalRevenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
    {
      $project: {
        dayNumber: "$_id",
        totalRevenue: 1,
        orderCount: 1,
        avgOrderValue: 1,
        _id: 0,
      },
    },
    { $sort: { dayNumber: 1 } },
  ]);

  const dayNames = [
    "",
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const formattedSales = salesByDayOfWeek.map((item) => ({
    dayOfWeek: dayNames[item.dayNumber] || "Unknown",
    dayNumber: item.dayNumber,
    totalRevenue: item.totalRevenue,
    orderCount: item.orderCount,
    avgOrderValue: item.avgOrderValue,
  }));

  return {
    salesByDayOfWeek: formattedSales,
  };
};

const getVoidAnalytics = async (
  filters: ComprehensiveAnalyticsFilters = {}
): Promise<VoidAnalytics> => {
  const matchQuery: any = {
    status: "VOIDED",
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

  const voidedOrders = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);

  const voidedOrdersCount = voidedOrders[0]?.count || 0;
  const voidedOrdersRevenue = voidedOrders[0]?.totalRevenue || 0;

  // Get total orders for void rate calculation
  const totalMatchQuery: any = {};
  if (filters.startDate || filters.endDate) {
    totalMatchQuery.createdAt = {};
    if (filters.startDate) {
      totalMatchQuery.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      totalMatchQuery.createdAt.$lte = filters.endDate;
    }
  }

  const totalOrders = await Order.countDocuments(totalMatchQuery);
  const voidRate = totalOrders > 0 ? (voidedOrdersCount / totalOrders) * 100 : 0;

  return {
    voidedOrdersCount,
    voidedOrdersRevenue,
    voidRate: Math.round(voidRate * 10) / 10,
  };
};

export const getComprehensiveAnalytics = async (
  filters: ComprehensiveAnalyticsFilters = {}
): Promise<ComprehensiveAnalytics> => {
  const [
    cashFlow,
    inventory,
    menu,
    orders,
    staff,
    tables,
    timing,
    dayOfWeek,
    voids,
  ] = await Promise.all([
    getSalesAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getInventoryAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getProductAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getOrderAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getStaffPerformance({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getTableAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getTimingAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getDayOfWeekAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    getVoidAnalytics({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
  ]);

  // Calculate summary stats
  const totalRevenue = cashFlow.revenueTrend.reduce(
    (sum, day) => sum + day.total,
    0
  );
  const totalOrders = orders.orderVolumeTrend.reduce(
    (sum, day) => sum + day.count,
    0
  );

  // Get active staff count
  const activeStaffCount = await User.countDocuments({
    status: "active",
    role: { $in: ["cashier", "waiter"] },
  });

  // Get top selling category
  const topCategory =
    menu.revenueByCategory.length > 0
      ? menu.revenueByCategory[0].categoryName
      : "N/A";

  // Get busiest day
  const busiestDayData = dayOfWeek.salesByDayOfWeek.reduce(
    (max, day) => (day.orderCount > max.orderCount ? day : max),
    dayOfWeek.salesByDayOfWeek[0] || { dayOfWeek: "N/A", orderCount: 0 }
  );
  const busiestDay = busiestDayData.dayOfWeek;

  // Get busiest hour
  const busiestHourData = orders.peakHours.reduce(
    (max, hour) => (hour.count > max.count ? hour : max),
    orders.peakHours[0] || { hour: 0, count: 0 }
  );
  const busiestHour = busiestHourData.hour;

  return {
    cashFlow,
    inventory,
    menu,
    orders,
    staff,
    tables,
    timing,
    dayOfWeek,
    voids,
    summary: {
      totalRevenue,
      totalOrders,
      averageOrderValue: orders.averageOrderValue,
      lowStockItemsCount: inventory.lowStockItems.length,
      activeStaffCount,
      voidedOrdersCount: voids.voidedOrdersCount,
      averageOrderCompletionTime: timing.averageOrderCompletionTime,
      topSellingCategory: topCategory,
      busiestDay,
      busiestHour,
    },
  };
};
