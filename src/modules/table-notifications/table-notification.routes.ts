import { Router } from "express";
import * as ctrl from "./table-notification.controller";
import { requireAuth } from "../../common/middleware/authMiddleware";

const router = Router();

// Public route for customers to call waiter
router.post("/", ctrl.create);

// Protected routes for cashiers/owners
router.get("/", requireAuth, ctrl.listActive);
router.patch("/:id/clear", requireAuth, ctrl.clear);
router.delete("/:id", requireAuth, ctrl.remove);

export default router;
