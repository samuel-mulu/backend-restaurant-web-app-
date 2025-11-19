import { Router } from "express";
import * as shiftCtrl from "./shifts.controller";
import { requireAuth } from "../../common/middleware/authMiddleware";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Shift management
router.post("/start", shiftCtrl.start);
router.post("/:id/end", shiftCtrl.end);
router.get("/", shiftCtrl.list);
router.get("/active", shiftCtrl.getActive);
router.get("/active/:staffId", shiftCtrl.getActive);
router.get("/history/:staffId", shiftCtrl.getHistory);
router.get("/:id", shiftCtrl.getById);
router.get("/:id/revenue", shiftCtrl.getRevenue);

export default router;

