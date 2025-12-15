import { Router } from "express";
import * as ctrl from "./item.controller";
import { requireAuth, requireOwner, requireRole } from "../../common/middleware/authMiddleware";
import { uploadImageMiddleware } from "../../common/middleware/upload";

const router = Router();

// public
router.get("/", ctrl.list);
// owner - specific routes must come before parameterized routes
router.get("/deleted", ctrl.getDeleted);
router.get("/unavailable", ctrl.getUnavailable);

// Approval routes - Owner only (must come before /:id routes)
// requireOwner includes requireAuth, but let's be explicit
router.get("/pending-approvals", requireAuth, requireOwner, ctrl.listPendingApprovals);

// owner/cashier for mutations (hard delete requested)
router.post("/", requireRole("owner", "cashier"), uploadImageMiddleware.single("image"), ctrl.create as any);
router.patch("/:id", requireRole("owner", "cashier"), uploadImageMiddleware.single("image"), ctrl.update as any);
router.delete("/:id", requireRole("owner", "cashier"), ctrl.remove);
router.patch("/:id/restore", requireRole("owner", "cashier"), ctrl.restore);
router.delete("/:id/permanent", requireRole("owner", "cashier"), ctrl.permanentDelete);
router.patch("/:id/availability", requireRole("owner", "cashier"), ctrl.availability);

// Approval routes - Owner only (approve/reject must come after other /:id routes but before /:id GET)
router.patch("/:id/approve", requireOwner, ctrl.approveItem);
router.patch("/:id/reject", requireOwner, ctrl.rejectItem);

// GET by ID (must come last after all specific routes)
router.get("/:id", ctrl.get);

export default router;
