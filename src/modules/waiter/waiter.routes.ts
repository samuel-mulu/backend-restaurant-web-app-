import { Router } from "express";
import { requireAuth, requireRole } from "../../common/middleware/authMiddleware";
import * as waiterCtrl from "./waiter.controller";

const router = Router();

router.use(requireAuth);
router.use(requireRole("waiter"));

router.get("/me/summary", waiterCtrl.getMySummary);
router.get("/me/orders", waiterCtrl.getMyOrders);
router.get("/me/salary", waiterCtrl.getMySalary);
router.get("/me/salary/:id/countdown", waiterCtrl.getMyCountdown);
router.get("/me/salary/:id/withdrawals", waiterCtrl.getMyWithdrawals);
router.get("/me/salary/:id/payments", waiterCtrl.getMyPayments);
router.get("/me/salary/:id", waiterCtrl.getMySalaryById);

export default router;
