import { Router } from "express";
import * as inventoryCtrl from "./inventory.controller";
import * as assignmentCtrl from "../inventory-assignments/inventory-assignment.controller";
import {
  requireAuth,
  requireOwner,
  requireRole,
} from "../../common/middleware/authMiddleware";
import { requireCashierResourceAccess } from "../../common/middleware/cashierPermissionMiddleware";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET routes: Cashier and Owner can access
router.get("/", inventoryCtrl.list);
router.get("/low-stock", inventoryCtrl.getLowStock);

// Approval routes - Owner only (must come before /:id routes)
router.get("/pending-approvals", requireOwner, inventoryCtrl.listPendingApprovals);
router.patch("/:id/approve", requireOwner, inventoryCtrl.approveInventory);
router.patch("/:id/reject", requireOwner, inventoryCtrl.rejectInventory);

// Assign to barman
router.post(
  "/:id/assign",
  requireRole("owner", "cashier"),
  ...assignmentCtrl.assign
);

// Create: owner + cashier
router.post("/", requireRole("owner", "cashier"), inventoryCtrl.create);

// Update / delete: owner always; cashier when enabled in settings
router.patch(
  "/:id",
  requireRole("owner", "cashier"),
  requireCashierResourceAccess("inventory"),
  inventoryCtrl.update
);
router.delete(
  "/:id",
  requireRole("owner", "cashier"),
  requireCashierResourceAccess("inventory"),
  inventoryCtrl.remove
);

// GET by ID (must come after specific routes)
router.get("/:id", inventoryCtrl.getById);

export default router;
