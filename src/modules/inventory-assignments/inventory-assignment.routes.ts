import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";
import * as ctrl from "./inventory-assignment.controller";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole("owner", "cashier", "barman"), ctrl.list);
router.patch(
  "/:id/approve",
  requireRole("barman"),
  ...ctrl.approve
);
router.patch("/:id/reject", requireRole("barman"), ctrl.reject);

export default router;
