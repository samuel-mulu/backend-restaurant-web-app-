import { Router } from "express";
import * as ctrl from "./table.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// List tables - available to all authenticated users
router.get("/", ctrl.list);

// Get table by ID
router.get("/:id", ctrl.getById);

// Get table by table number
router.get("/number/:tableNumber", ctrl.getByNumber);

// Create, update, delete - owner and cashier only
router.post("/", requireRole("owner", "cashier"), ctrl.create);
router.patch("/:id", requireRole("owner", "cashier"), ctrl.update);
router.delete("/:id", requireRole("owner", "cashier"), ctrl.remove);

export default router;
