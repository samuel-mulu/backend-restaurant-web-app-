import { Router } from "express";
import * as statisticsCtrl from "./statistics.controller";
import {
  requireAuth,
  requireOwner,
} from "../../common/middleware/authMiddleware";

const router = Router();

// All routes require authentication and owner role
router.use(requireAuth);
router.use(requireOwner);

router.get("/dashboard", statisticsCtrl.getDashboard);
router.get("/sales", statisticsCtrl.getSales);
router.get("/products", statisticsCtrl.getProducts);
router.get("/staff", statisticsCtrl.getStaff);
router.get("/inventory", statisticsCtrl.getInventory);
router.get("/comprehensive", statisticsCtrl.getComprehensive);

export default router;
