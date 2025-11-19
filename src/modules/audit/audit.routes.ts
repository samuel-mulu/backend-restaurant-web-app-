import { Router } from "express";
import * as auditCtrl from "./audit.controller";
import {
  requireAuth,
  requireOwner,
} from "../../common/middleware/authMiddleware";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET routes
router.get("/", auditCtrl.list);
router.get("/entity/:entityType/:entityId", auditCtrl.getByEntity);
router.get("/user/:userId", requireOwner, auditCtrl.getByUser);
router.get("/me", auditCtrl.getByUser); // Current user's audit logs

export default router;
