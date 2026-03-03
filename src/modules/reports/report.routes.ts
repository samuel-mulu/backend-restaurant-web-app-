import { Router } from "express";
import { requireAuth, requireRole } from "../../common/middleware/authMiddleware";
import * as reportController from "./report.controller";

const router = Router();

router.use(requireAuth);
router.use(requireRole("owner"));

router.get("/daily", reportController.getDailyReport);
router.get("/monthly", reportController.getMonthlyReport);
router.get("/staff-orders", reportController.getStaffOrderDetails);

export default router;
