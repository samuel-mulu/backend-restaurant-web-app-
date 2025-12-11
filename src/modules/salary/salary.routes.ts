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
router.get("/:id/countdown", salaryCtrl.getCountdown);
router.get("/:id/net-amount", salaryCtrl.getNetAmount);

// POST, PATCH, DELETE: Owner only with rate limiting
router.post("/", sensitiveEndpointLimiter, salaryCtrl.create);
router.patch("/:id", salaryCtrl.update);
router.delete("/:id", sensitiveEndpointLimiter, salaryCtrl.deleteSalary);

// Withdrawal routes
router.post(
  "/:id/withdrawals",
  sensitiveEndpointLimiter,
  salaryCtrl.createWithdrawal
);
router.get("/:id/withdrawals", salaryCtrl.listWithdrawals);
router.delete("/:id/withdrawals/:withdrawalId", salaryCtrl.deleteWithdrawal);

// Payment routes
router.post(
  "/:id/payments",
  sensitiveEndpointLimiter,
  salaryCtrl.createPayment
);
router.get("/:id/payments", salaryCtrl.listPayments);
router.delete("/:id/payments/:paymentId", salaryCtrl.deletePayment);

export default router;
