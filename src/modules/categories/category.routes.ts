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
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
