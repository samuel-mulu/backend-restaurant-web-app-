import { Router } from "express";
import * as inventoryCtrl from "./inventory.controller";
import {
  requireAuth,
  requireCashier,
} from "../../common/middleware/authMiddleware";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET routes: Cashier and Owner can access
router.get("/", inventoryCtrl.list);
router.get("/low-stock", inventoryCtrl.getLowStock);
router.get("/:id/history", inventoryCtrl.getPurchaseHistory);
router.get("/:id", inventoryCtrl.getById);

// POST, PATCH: Cashier only
router.post("/", requireCashier, inventoryCtrl.create);
router.patch("/:id", requireCashier, inventoryCtrl.update);
router.post("/:id/purchase", requireCashier, inventoryCtrl.recordPurchase);

export default router;
