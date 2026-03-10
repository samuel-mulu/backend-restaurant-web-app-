// Socket event handlers for real-time notifications
import { OrderDoc } from "../modules/orders/order.model";
import { getIO } from "./socket";

type EventSource = "api" | "change_stream";

type PlainOrder = ReturnType<typeof toPlainOrder>;

function toPlainOrder(order: OrderDoc): Record<string, any> {
  const plain = JSON.parse(JSON.stringify(order));
  if (!plain.id) {
    plain.id = plain._id;
  }
  plain._id = plain._id?.toString?.() ?? plain._id;

  if (Array.isArray(plain.items)) {
    plain.items = plain.items.map((item: any) => {
      if (item?._id && !item.id) {
        item.id = item._id;
      }
      if (item?.itemId && typeof item.itemId === "object") {
        item.itemId._id = item.itemId._id?.toString?.() ?? item.itemId._id;
      }
      return item;
    });
  }

  return plain;
}

// Notify cashiers and owners of new orders
export const notifyCashiersNewOrder = (
  order: OrderDoc,
  source: EventSource = "api"
) => {
  try {
    const io = getIO();
    const payload: PlainOrder = toPlainOrder(order);


    io.to("cashier:orders").emit("newOrder", {
      type: "new_order",
      data: payload,
      timestamp: new Date(),
      source,
    });

    io.to("owner:orders").emit("orderCreated", {
      type: "order_created",
      data: payload,
      timestamp: new Date(),
      source,
    });

    io.to("orders:general").emit("orderEvent", {
      type: "order_created",
      data: payload,
      timestamp: new Date(),
      source,
    });
  } catch (error) {
    console.error("Error sending new order notification:", error);
  }
};

// Notify customer and owner clients of order status updates
export const notifyCustomerOrderUpdated = (
  order: OrderDoc,
  {
    source = "api",
    updatedFields = {},
    broadcastToCustomer = true,
  }: {
    source?: EventSource;
    updatedFields?: Record<string, unknown>;
    broadcastToCustomer?: boolean;
  } = {}
) => {
  try {
    const io = getIO();
    const payload: PlainOrder = toPlainOrder(order);


    const baseUpdate = {
      id: payload._id,
      orderId: payload._id,
      orderNumber: payload.orderNumber,
      status: payload.status,
      order: payload,
    };

    if (broadcastToCustomer && payload.customerChannel) {
      io.to(`customer:${payload.customerChannel}`).emit("orderUpdate", {
        type: "order_status_update",
        data: baseUpdate,
        timestamp: new Date(),
        source,
      });
    }

    // Emit order status changed event
    io.to("orders:general").emit("order:status:changed", {
      type: "order_status_changed",
      data: {
        orderId: payload._id,
        orderNumber: payload.orderNumber,
        status: payload.status,
        updatedFields,
      },
      timestamp: new Date(),
      source,
    });

    // Notify waiter if order is assigned
    if (payload.waiterId) {
      io.to(`waiter:${payload.waiterId}`).emit("order:assigned:waiter", {
        type: "order_assigned_waiter",
        data: {
          orderId: payload._id,
          orderNumber: payload.orderNumber,
          status: payload.status,
          waiterId: payload.waiterId,
        },
        timestamp: new Date(),
        source,
      });
    }

    io.to("owner:orders").emit("orderUpdated", {
      type: "order_updated",
      data: payload,
      meta: {
        updatedFields: {
          status: payload.status,
          decidedAt: payload.decidedAt,
          ...updatedFields,
        },
      },
      timestamp: new Date(),
      source,
    });

    io.to("cashier:orders").emit("orderUpdated", {
      type: "order_updated",
      data: payload,
      meta: {
        updatedFields: {
          status: payload.status,
          decidedAt: payload.decidedAt,
          ...updatedFields,
        },
      },
      timestamp: new Date(),
      source,
    });

    io.to("orders:general").emit("orderEvent", {
      type: "order_updated",
      data: payload,
      timestamp: new Date(),
      source,
    });
  } catch (error) {
    console.error("Error sending order update notification:", error);
  }
};

// Broadcast order statistics
export const broadcastOrderStats = (stats: {
  totalOrders: number;
  pendingOrders: number;
  acceptedOrders: number;
  rejectedOrders: number;
}) => {
  try {
    const io = getIO();

    io.to("owner:orders").emit("orderStats", {
      type: "order_statistics",
      data: stats,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting order statistics:", error);
  }
};

// Send system notification to all connected clients
export const broadcastSystemNotification = (
  message: string,
  type: "info" | "warning" | "error" = "info"
) => {
  try {
    const io = getIO();

    io.emit("systemNotification", {
      type: "system_notification",
      data: { message, notificationType: type },
      timestamp: new Date(),
      source: "system",
    });
  } catch (error) {
    console.error("Error broadcasting system notification:", error);
  }
};

// Item Management Notifications
export const notifyItemCreated = (itemData: {
  id: string;
  name: string;
  category: string;
  price: number;
  type: "food" | "beverage";
}) => {
  try {
    const io = getIO();

    io.to("owner:items").emit("itemCreated", {
      type: "item_created",
      data: itemData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:orders").emit("itemCreated", {
      type: "item_created",
      data: itemData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting item created notification:", error);
  }
};

export const notifyItemUpdated = (itemData: {
  id: string;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
}) => {
  try {
    const io = getIO();

    io.to("owner:items").emit("itemUpdated", {
      type: "item_updated",
      data: itemData,
      timestamp: new Date(),
      source: "api",
    });

    // If availability changed, notify orders room
    if (itemData.isAvailable !== undefined) {
      io.to("owner:orders").emit("itemAvailabilityChanged", {
        type: "item_availability_changed",
        data: itemData,
        timestamp: new Date(),
        source: "api",
      });
    }
  } catch (error) {
    console.error("Error broadcasting item updated notification:", error);
  }
};

export const notifyItemDeleted = (itemData: { id: string; name: string }) => {
  try {
    const io = getIO();

    io.to("owner:items").emit("itemDeleted", {
      type: "item_deleted",
      data: itemData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:orders").emit("itemDeleted", {
      type: "item_deleted",
      data: itemData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting item deleted notification:", error);
  }
};

// Category Management Notifications
export const notifyCategoryCreated = (categoryData: {
  id: string;
  name: string;
  type: "food" | "beverage";
}) => {
  try {
    const io = getIO();

    io.to("owner:categories").emit("categoryCreated", {
      type: "category_created",
      data: categoryData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:items").emit("categoryCreated", {
      type: "category_created",
      data: categoryData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting category created notification:", error);
  }
};

export const notifyCategoryUpdated = (categoryData: {
  id: string;
  name: string;
  type: "food" | "beverage";
  isActive: boolean;
}) => {
  try {
    const io = getIO();

    io.to("owner:categories").emit("categoryUpdated", {
      type: "category_updated",
      data: categoryData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:items").emit("categoryUpdated", {
      type: "category_updated",
      data: categoryData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting category updated notification:", error);
  }
};

export const notifyCategoryDeleted = (categoryData: {
  id: string;
  name: string;
}) => {
  try {
    const io = getIO();

    io.to("owner:categories").emit("categoryDeleted", {
      type: "category_deleted",
      data: categoryData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:items").emit("categoryDeleted", {
      type: "category_deleted",
      data: categoryData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting category deleted notification:", error);
  }
};

// User Management Notifications
export const notifyUserCreated = (userData: {
  id: string;
  name: string;
  email: string;
  role: string;
}) => {
  try {
    const io = getIO();

    io.to("owner:users").emit("userCreated", {
      type: "user_created",
      data: userData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting user created notification:", error);
  }
};

// Analytics and Statistics Notifications
export const broadcastAnalyticsUpdate = (analyticsData: {
  dailyOrders: number;
  totalRevenue: number;
  popularItems: any[];
  orderTrends: any[];
}) => {
  try {
    const io = getIO();

    io.to("owner:dashboard").emit("analyticsUpdate", {
      type: "analytics_update",
      data: analyticsData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting analytics update:", error);
  }
};

// Inventory low stock alerts
export const notifyInventoryLowStock = (inventoryData: {
  inventoryId: string;
  inventoryName: string;
  quantity: number;
  minThreshold: number;
}) => {
  try {
    const io = getIO();

    io.to("owner:inventory").emit("inventory:low:stock", {
      type: "inventory_low_stock",
      data: inventoryData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("cashier:inventory").emit("inventory:low:stock", {
      type: "inventory_low_stock",
      data: inventoryData,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:inventory").emit("inventory:low:stock", {
      type: "inventory_low_stock",
      data: inventoryData,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting inventory low stock alert:", error);
  }
};

// Real-time statistics updates
export const broadcastStatisticsUpdate = (stats: {
  totalSales: number;
  totalOrders: number;
  activeStaffCount: number;
  lowStockItemsCount: number;
}) => {
  try {
    const io = getIO();

    io.to("owner:dashboard").emit("statistics:updated", {
      type: "statistics_updated",
      data: stats,
      timestamp: new Date(),
      source: "api",
    });

    io.to("owner:dashboard").emit("statistics:updated", {
      type: "statistics_updated",
      data: stats,
      timestamp: new Date(),
      source: "api",
    });
  } catch (error) {
    console.error("Error broadcasting statistics update:", error);
  }
};
