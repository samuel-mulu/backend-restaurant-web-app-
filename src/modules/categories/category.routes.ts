import { Router } from "express";
import * as ctrl from "./category.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";
import { requireCashierResourceAccess } from "../../common/middleware/cashierPermissionMiddleware";

const router = Router();

// public (customer) can list categories
router.get("/", ctrl.list);

// Create: owner + cashier
router.post(
  "/",
  requireAuth,
  requireRole("owner", "cashier"),
  ctrl.create
);

// Update / delete: owner always; cashier only when enabled
router.patch(
  "/:id",
  requireAuth,
  requireRole("owner", "cashier"),
  requireCashierResourceAccess("categories"),
  ctrl.update
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("owner", "cashier"),
  requireCashierResourceAccess("categories"),
  ctrl.remove
);

export default router;
