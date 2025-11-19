import { Router } from "express";
import * as syncCtrl from "./sync.controller";
import { requireAuth } from "../../common/middleware/authMiddleware";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiting for sync endpoint (prevent abuse)
const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Too many sync requests, please try again later",
});

router.use(requireAuth);
router.post("/", syncLimiter, syncCtrl.sync);

export default router;
