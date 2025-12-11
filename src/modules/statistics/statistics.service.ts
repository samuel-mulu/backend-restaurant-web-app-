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

export interface ComprehensiveAnalytics {
  cashFlow: SalesAnalytics;
  inventory: InventoryAnalytics;
  menu: ProductAnalytics;
  orders: OrderAnalytics;
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    lowStockItemsCount: number;
  };
}

export const getComprehensiveAnalytics = async (
  filters: ComprehensiveAnalyticsFilters = {}
): Promise<ComprehensiveAnalytics> => {
  const [cashFlow, inventory, menu, orders] = await Promise.all([
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

  return {
    cashFlow,
    inventory,
    menu,
    orders,
    summary: {
      totalRevenue,
      totalOrders,
      averageOrderValue: orders.averageOrderValue,
      lowStockItemsCount: inventory.lowStockItems.length,
    },
  };
};
