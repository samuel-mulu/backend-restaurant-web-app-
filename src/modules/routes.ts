import { Router } from "express";
import orderRoutes from "./orders/order.routes";
import authRoutes from "./auth/auth.routes";
import categoryRoutes from "./categories/category.routes";
import itemRoutes from "./items/item.routes";
import notificationRoutes from "./notification/notification.routes";
import staffRoutes from "./staff/staff.routes";
import salaryRoutes from "./salary/salary.routes";
import inventoryRoutes from "./inventory/inventory.routes";
import statisticsRoutes from "./statistics/statistics.routes";
import auditRoutes from "./audit/audit.routes";
import shiftsRoutes from "./shifts/shifts.routes";
import syncRoutes from "./sync/sync.routes";
import ownerRoutes from "./owner/owner.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/categories", categoryRoutes);
router.use("/items", itemRoutes);
router.use("/notifications", notificationRoutes);
router.use("/staff", staffRoutes);
router.use("/salary", salaryRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/statistics", statisticsRoutes);
router.use("/audit", auditRoutes);
router.use("/shifts", shiftsRoutes);
router.use("/sync", syncRoutes);
router.use("/owner", ownerRoutes);

export default router;
