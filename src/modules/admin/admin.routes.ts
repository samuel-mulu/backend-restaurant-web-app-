import { Router } from "express";
import * as adminCtrl from "./admin.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";

const router = Router();

// All admin routes require admin authentication
router.use(requireAuth);

// Dashboard and statistics
router.get("/dashboard", requireRole("owner"), adminCtrl.getDashboardStats);
router.get("/orders/recent", adminCtrl.getRecentOrders);

// Order management (admin can also manage orders)
router.get("/orders", adminCtrl.getAllOrders);
router.patch("/orders/:id/accept", adminCtrl.acceptOrder);
router.patch("/orders/:id/reject", adminCtrl.rejectOrder);

// User management
router.get("/users", requireRole("owner"), adminCtrl.getUsers);
router.post("/users", requireRole("owner"), adminCtrl.createUser);
router.put("/users/:id", requireRole("owner"), adminCtrl.updateUser);
router.delete("/users/:id", requireRole("owner"), adminCtrl.deleteUser);
router.patch(
  "/users/:id/reset-password",
  requireRole("owner"),
  adminCtrl.resetUserPassword
);

export default router;
