import { Router } from "express";
import * as notificationCtrl from "./notification.controller";
import { requireAuth } from "../../common/middleware/authMiddleware";

const router = Router();

// All notification routes require authentication (cashier or owner)
router.use(requireAuth);

// Get notifications for a user
router.get("/user/:userId", notificationCtrl.getUserNotifications);

// Mark notification as read
router.patch("/:id/read", notificationCtrl.markAsRead);

// Mark all notifications as read for a user
router.patch("/user/:userId/read-all", notificationCtrl.markAllAsRead);

// Create a notification (owner only)
router.post("/", notificationCtrl.createNotification);

// Delete a notification
router.delete("/:id", notificationCtrl.deleteNotification);

export default router;
