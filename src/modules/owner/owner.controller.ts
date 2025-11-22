import { Request, Response } from "express";
import { User } from "../auth/user.model";
import { Order } from "../orders/order.model";
import { Item } from "../items/item.model";
import { Category } from "../categories/category.model";
import { Notification } from "../notification/notification.model";
import { hashPassword } from "../../common/utils/password";
import * as orderService from "../orders/order.service";

// Get system overview/dashboard stats
export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalOrders,
      pendingOrders,
      acceptedOrders,
      rejectedOrders,
      totalItems,
      availableItems,
      totalCategories,
      todayOrders,
      totalRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "accepted" }),
      Order.countDocuments({ status: "rejected" }),
      Item.countDocuments({ isDeleted: false }),
      Item.countDocuments({ isDeleted: false, isAvailable: true }),
      Category.countDocuments(),
      Order.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
      Order.aggregate([
        { $match: { status: "accepted" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const revenueAmount = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    res.json({
      users: {
        total: totalUsers,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        accepted: acceptedOrders,
        rejected: rejectedOrders,
        today: todayOrders,
      },
      items: {
        total: totalItems,
        available: availableItems,
        unavailable: totalItems - availableItems,
      },
      categories: {
        total: totalCategories,
      },
      revenue: {
        total: revenueAmount,
      },
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Failed to get dashboard statistics" });
  }
};

// Get all users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, role } = req.query;

    const query: any = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
};

// Create a new user (cashier)
export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = "cashier" } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    // Remove password from response
    const userResponse = user.toObject();
    const { password: _, ...userWithoutPassword } = userResponse;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { name, email, role, isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// Reset user password
export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const hashedPassword = await hashPassword(password);

    const user = await User.findByIdAndUpdate(
      id,
      { password: hashedPassword },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

// Get recent orders for owner overview
export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate(
        "items.itemId",
        "name description price images type isAvailable"
      );

    res.json(orders);
  } catch (error) {
    console.error("Error getting recent orders:", error);
    res.status(500).json({ error: "Failed to get recent orders" });
  }
};

// Get all orders for owner management
export const getAllOrders = async (_req: Request, res: Response) => {
  try {
    const orders = await orderService.listOrders();
    res.json(orders);
  } catch (error) {
    console.error("Error getting all orders:", error);
    res.status(500).json({ error: "Failed to get orders" });
  }
};

// Accept order (owner can also accept orders)
export const acceptOrder = async (req: Request, res: Response) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      "accepted"
    );
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Error accepting order:", error);
    res.status(500).json({ error: "Failed to accept order" });
  }
};

// Reject order (owner can also reject orders)
export const rejectOrder = async (req: Request, res: Response) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      "rejected"
    );
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({ error: "Failed to reject order" });
  }
};

