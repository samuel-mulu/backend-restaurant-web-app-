import { Request, Response } from "express";
import { TableNotification } from "./table-notification.model";
import { getIO } from "../../sockets/socket";

// Create a new table notification (called by customer)
export const create = async (req: Request, res: Response) => {
  try {
    const { tableNumber, metadata } = req.body;

    if (!tableNumber) {
      return res.status(400).json({
        success: false,
        message: "Table number is required",
      });
    }

    const notification = await TableNotification.create({
      tableNumber,
      metadata,
    });

    // Notify all cashiers/owners via socket
    const io = getIO();
    io.to("owner:orders").to("cashier:orders").emit("new-table-notification", notification);

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create table notification",
    });
  }
};

// List active/pending notifications (called by cashier)
export const listActive = async (req: Request, res: Response) => {
  try {
    console.log(`[TableNotifications] Fetching pending notifications for user ${req.user?.name} (Role: ${req.user?.role})`);
    const notifications = await TableNotification.find({ status: "pending" })
      .sort({ createdAt: -1 });

    console.log(`[TableNotifications] Found ${notifications.length} pending notifications`);
    res.json({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch table notifications",
    });
  }
};

// Clear a notification (called by cashier)
export const clear = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await TableNotification.findByIdAndUpdate(
      id,
      { status: "cleared" },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Notify all cashiers/owners that it's cleared
    const io = getIO();
    io.to("owner:orders").to("cashier:orders").emit("table-notification-cleared", id);

    res.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to clear table notification",
    });
  }
};

// Permanently delete a notification
export const remove = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await TableNotification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
};
