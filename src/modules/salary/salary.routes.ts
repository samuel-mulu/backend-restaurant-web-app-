import { Router } from "express";
import * as salaryCtrl from "./salary.controller";
import {
  requireAuth,
  requireOwner,
} from "../../common/middleware/authMiddleware";
import { sensitiveEndpointLimiter } from "../../common/middleware/rateLimiter";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// All routes require owner role
router.use(requireOwner);

// GET routes
router.get("/", salaryCtrl.list);
router.get("/summary", salaryCtrl.getSummary);
router.get("/staff/:staffId", salaryCtrl.getStaffHistory);
router.get("/:id", salaryCtrl.getById);

// POST, PATCH: Owner only with rate limiting
router.post("/", sensitiveEndpointLimiter, salaryCtrl.create);
router.patch("/:id", salaryCtrl.update);

export default router;
