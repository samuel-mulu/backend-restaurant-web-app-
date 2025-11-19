import { Router } from "express";
import * as ctrl from "./category.controller";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";

const router = Router();

// public (customer) can list categories
router.get("/", ctrl.list);

// admin only for CRUD
router.post("/", requireAuth, requireRole("owner"), ctrl.create);
router.put("/:id", requireAuth, requireRole("owner"), ctrl.update);
router.delete("/:id", requireAuth, requireRole("owner"), ctrl.remove);

export default router;
