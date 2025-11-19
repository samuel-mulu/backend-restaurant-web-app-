import { Router } from "express";
import * as ctrl from "./item.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";
import { uploadMultipleImagesMiddleware } from "../../common/middleware/upload";

const router = Router();

// public
router.get("/", ctrl.list);
// admin - specific routes must come before parameterized routes
router.get("/deleted", requireAuth, requireRole("owner"), ctrl.getDeleted);
router.get(
  "/unavailable",
  requireAuth,
  requireRole("owner"),
  ctrl.getUnavailable
);
router.get("/:id", ctrl.get);

// admin
router.post(
  "/",
  requireAuth,
  requireRole("cashier", "owner"),
  uploadMultipleImagesMiddleware,
  ctrl.create as any
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("cashier", "owner"),
  uploadMultipleImagesMiddleware,
  ctrl.update as any
);
router.patch(
  "/:id/stock",
  requireAuth,
  requireRole("cashier", "owner"),
  ctrl.updateStock
);
router.delete("/:id", requireAuth, requireRole("owner"), ctrl.remove);
router.patch("/:id/restore", requireAuth, requireRole("owner"), ctrl.restore);
router.delete(
  "/:id/permanent",
  requireAuth,
  requireRole("owner"),
  ctrl.permanentDelete
);
router.patch(
  "/:id/availability",
  requireAuth,
  requireRole("owner"),
  ctrl.availability
);

export default router;
