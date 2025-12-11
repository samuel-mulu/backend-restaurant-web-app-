import { Router } from "express";
import * as inventoryCtrl from "./inventory.controller";
import {
  requireAuth,
  requireCashier,
  requireOwner,
} from "../../common/middleware/authMiddleware";

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

// POST, PATCH: Cashier only
router.post("/", requireCashier, inventoryCtrl.create);
router.patch("/:id", requireCashier, inventoryCtrl.update);

// GET by ID (must come after specific routes)
router.get("/:id", inventoryCtrl.getById);

export default router;
