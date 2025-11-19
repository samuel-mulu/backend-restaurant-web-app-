import { Router } from "express";
import * as ctrl from "./auth.controller";
import {
  requireOwner,
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";
import { authLimiter, sensitiveEndpointLimiter } from "../../common/middleware/rateLimiter";

const router = Router();

router.post("/register", sensitiveEndpointLimiter, requireOwner, ctrl.register);
router.post("/login", authLimiter, ctrl.login);
router.post("/logout", ctrl.logout);
router.post("/refresh", ctrl.refreshToken);
router.get("/profile", requireAuth, ctrl.profile);
router.get("/users", requireAuth, requireRole("owner"), ctrl.list);
router.patch(
  "/users/:id/disable",
  requireAuth,
  requireRole("owner"),
  ctrl.disable
);

export default router;
