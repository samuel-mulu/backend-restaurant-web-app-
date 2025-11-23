import { Router } from "express";
import * as ownerCtrl from "./owner.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";

const router = Router();

// All owner routes require authentication
router.use(requireAuth);

// Dashboard and statistics
router.get("/dashboard", requireRole("owner"), ownerCtrl.getDashboardStats);
router.get("/orders/recent", ownerCtrl.getRecentOrders);

// Order management (owner can also manage orders)
router.get("/orders", ownerCtrl.getAllOrders);
router.patch("/orders/:id/accept", ownerCtrl.acceptOrder);
router.patch("/orders/:id/reject", ownerCtrl.rejectOrder);

// User management
router.get("/users", requireRole("owner"), ownerCtrl.getUsers);
router.post("/users", requireRole("owner"), ownerCtrl.createUser);
router.put("/users/:id", requireRole("owner"), ownerCtrl.updateUser);
router.delete("/users/:id", requireRole("owner"), ownerCtrl.deleteUser);
router.patch(
  "/users/:id/reset-password",
  requireRole("owner"),
  ownerCtrl.resetUserPassword
);

export default router;

