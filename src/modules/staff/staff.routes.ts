import { Router } from "express";
import * as staffCtrl from "./staff.controller";
import { requireAuth, requireOwner, requireRole } from "../../common/middleware/authMiddleware";
import { sensitiveEndpointLimiter } from "../../common/middleware/rateLimiter";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET routes: Owner can see all, Cashier/Waiter can see active only
router.get("/", staffCtrl.list);
router.get("/:id", staffCtrl.getById);
router.get("/:id/attendance", staffCtrl.getAttendance);

// POST, PATCH, DELETE: Owner only with rate limiting
router.post("/", sensitiveEndpointLimiter, requireOwner, staffCtrl.create);
router.patch("/:id", requireOwner, staffCtrl.update);
router.delete("/:id", requireRole("owner", "cashier"), staffCtrl.remove);

export default router;
