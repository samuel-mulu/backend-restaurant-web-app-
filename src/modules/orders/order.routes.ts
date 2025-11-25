import { Router } from "express";
import * as orderCtrl from "./order.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";

const router = Router();

// Create order (Cashier only)
router.post(
  "/",
  requireAuth,
  requireRole("cashier", "owner"),
  orderCtrl.create
);

// Protected routes
router.get("/", requireAuth, orderCtrl.list);
router.get("/waiter/:waiterId", requireAuth, orderCtrl.getByWaiter);
router.get("/cashier/:cashierId", requireAuth, orderCtrl.getByCashier);

// Report routes (Owner only) - must be before /:id route
router.get(
  "/reports/daily",
  requireAuth,
  requireRole("owner"),
  orderCtrl.getDailyReport
);

router.get(
  "/reports/cashier/:cashierId",
  requireAuth,
  requireRole("cashier", "owner"),
  orderCtrl.getCashierReport
);

router.get(
  "/reports/waiter/:waiterId",
  requireAuth,
  requireRole("owner"),
  orderCtrl.getWaiterReport
);

router.get(
  "/reports/status",
  requireAuth,
  requireRole("owner"),
  orderCtrl.getStatusReport
);

router.get(
  "/reports/date-range",
  requireAuth,
  requireRole("owner"),
  orderCtrl.getDateRangeReport
);

// Bulk update order statuses (Cashier/Owner can update)
router.patch(
  "/bulk/status",
  requireAuth,
  requireRole("cashier", "owner"),
  orderCtrl.bulkUpdateStatus
);

// Update order status (Cashier/Owner can update)
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("cashier", "owner"),
  orderCtrl.updateStatus
);

// Cancel order (Cashier only - soft delete via status update)
router.patch(
  "/:id/cancel",
  requireAuth,
  requireRole("cashier"),
  orderCtrl.cancel
);

// Update order (Cashier only)
router.patch(
  "/:id",
  requireAuth,
  requireRole("cashier", "owner"),
  orderCtrl.update
);

router.patch(
  "/:id/print",
  requireAuth,
  requireRole("cashier", "owner"),
  orderCtrl.markAsPrinted
);

// Get single order details (for customers with order code or authenticated users)
router.get("/:id", orderCtrl.getOrder);

export default router;
