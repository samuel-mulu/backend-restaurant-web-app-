import { Request, Response } from "express";
import * as orderService from "./order.service";
import { OrderStatus } from "./order.model";

export const create = async (req: Request, res: Response) => {
  try {
    // Auto-assign cashierId if user is cashier
    const cashierId = req.user?.role === "cashier" ? req.user._id : undefined;
    const order = await orderService.createOrder(req.body, cashierId);
    res.status(201).json(order);
  } catch (error: any) {
    console.error("Error creating order:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as any,
      waiterId: req.query.waiterId as string,
      cashierId: req.query.cashierId as string,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      search: req.query.search as string,
      tableNumber: req.query.tableNumber as string,
    };

    // If waiter, only show their orders
    if (req.user?.role === "waiter") {
      filters.waiterId = req.user._id;
    }

    // If cashier, only show orders they created (unless owner is viewing)
    if (req.user?.role === "cashier" && !req.query.cashierId) {
      filters.cashierId = req.user._id;
    }

    const orders = await orderService.listOrders(filters);
    res.json(orders);
  } catch (error) {
    console.error("Error listing orders:", error);
    res.status(500).json({ error: "Failed to list orders" });
  }
};

export const getOrder = async (req: Request, res: Response) => {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(500).json({ error: "Failed to get order" });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user._id
    );
    res.json(order);
  } catch (error: any) {
    console.error("Error updating order status:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to update order status" });
  }
};

export const bulkUpdateStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { orderIds, status } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: "Order IDs array is required" });
    }
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const result = await orderService.bulkUpdateOrderStatus(
      orderIds,
      status,
      req.user._id
    );

    res.json({
      success: true,
      updated: result.updated,
      failed: result.failed,
      message: `Updated ${result.updated.length} order(s)${
        result.failed.length > 0 ? `, ${result.failed.length} failed` : ""
      }`,
    });
  } catch (error: any) {
    console.error("Error bulk updating order status:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to bulk update order status" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const order = await orderService.updateOrder(req.params.id, req.body);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("Error updating order:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to update order" });
  }
};

export const getByWaiter = async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getOrdersByWaiter(req.params.waiterId);
    res.json(orders);
  } catch (error) {
    console.error("Error getting orders by waiter:", error);
    res.status(500).json({ error: "Failed to get orders by waiter" });
  }
};

export const getByCashier = async (req: Request, res: Response) => {
  try {
    const { cashierId } = req.params;
    const { status, waiterId, startDate, endDate } = req.query;

    let filters:
      | {
          status?: OrderStatus | OrderStatus[];
          waiterId?: string;
          startDate?: Date;
          endDate?: Date;
        }
      | undefined = undefined;

    if (
      status ||
      (waiterId && typeof waiterId === "string") ||
      (startDate && typeof startDate === "string") ||
      (endDate && typeof endDate === "string")
    ) {
      filters = {};
      if (status) {
        // Handle array of statuses (comma-separated string or array)
        if (Array.isArray(status)) {
          filters.status = status as OrderStatus[];
        } else if (typeof status === "string") {
          // Check if comma-separated
          if (status.includes(",")) {
            filters.status = status
              .split(",")
              .map((s) => s.trim()) as OrderStatus[];
          } else {
            filters.status = status as OrderStatus;
          }
        }
      }
      if (waiterId && typeof waiterId === "string") {
        filters.waiterId = waiterId;
      }
      if (startDate && typeof startDate === "string") {
        filters.startDate = new Date(startDate);
      }
      if (endDate && typeof endDate === "string") {
        filters.endDate = new Date(endDate);
      }
    }

    const orders = await orderService.getOrdersByCashier(cashierId, filters);
    res.json(orders);
  } catch (error) {
    console.error("Error getting orders by cashier:", error);
    res.status(500).json({ error: "Failed to get orders by cashier" });
  }
};

export const markAsPrinted = async (req: Request, res: Response) => {
  try {
    const order = await orderService.markOrderAsPrinted(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Error marking order as printed:", error);
    res.status(500).json({ error: "Failed to mark order as printed" });
  }
};

export const printOrder = async (req: Request, res: Response) => {
  try {
    const order = await orderService.printOrder(req.params.id);
    res.json({ success: true, order });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error printing order:", errorMessage);
    res.status(500).json({
      error: "Failed to print order",
      details: errorMessage,
    });
  }
};

export const cancel = async (req: Request, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const order = await orderService.cancelOrder(req.params.id, req.user._id);
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("Error cancelling order:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to cancel order" });
  }
};

// Report Controllers

export const getDailyReport = async (req: Request, res: Response) => {
  try {
    const date = req.query.date
      ? new Date(req.query.date as string)
      : undefined;
    const report = await orderService.getDailyReport(date);
    res.json(report);
  } catch (error: any) {
    console.error("Error getting daily report:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to get daily report" });
  }
};

export const getCashierReport = async (req: Request, res: Response) => {
  try {
    const { cashierId } = req.params;
    const user = req.user;

    // If user is cashier, they can only access their own report
    if (user?.role === "cashier" && user._id?.toString() !== cashierId) {
      return res.status(403).json({
        error: "You can only access your own cashier report",
      });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const report = await orderService.getCashierReport(
      cashierId,
      startDate,
      endDate
    );
    res.json(report);
  } catch (error: any) {
    console.error("Error getting cashier report:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to get cashier report" });
  }
};

export const getWaiterReport = async (req: Request, res: Response) => {
  try {
    const { waiterId } = req.params;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const report = await orderService.getWaiterReport(
      waiterId,
      startDate,
      endDate
    );
    res.json(report);
  } catch (error: any) {
    console.error("Error getting waiter report:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to get waiter report" });
  }
};

export const getStatusReport = async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const report = await orderService.getStatusReport(startDate, endDate);
    res.json(report);
  } catch (error: any) {
    console.error("Error getting status report:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to get status report" });
  }
};

export const getDateRangeReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required" });
    }

    const report = await orderService.getDateRangeReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json(report);
  } catch (error: any) {
    console.error("Error getting date range report:", error);
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to get date range report" });
  }
};
