import { Request, Response } from "express";
import * as orderService from "./order.service";

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
    };

    // If waiter, only show their orders
    if (req.user?.role === "waiter") {
      filters.waiterId = req.user._id;
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
    const orders = await orderService.getOrdersByCashier(req.params.cashierId);
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
