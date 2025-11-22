import { Router } from "express";
import * as ctrl from "./auth.controller";
import {
  requireOwner,
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";
import { authLimiter, sensitiveEndpointLimiter } from "../../common/middleware/rateLimiter";
import { validate } from "../../common/middleware/validate";
import {
  updateOwnerProfileSchema,
  updateStaffProfileSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", sensitiveEndpointLimiter, requireOwner, ctrl.register);
router.post("/login", authLimiter, ctrl.login);
router.post("/logout", ctrl.logout);
router.post("/refresh", ctrl.refreshToken);
router.get("/profile", requireAuth, ctrl.profile);
router.patch(
  "/profile",
  requireAuth,
  (req: any, res: any, next: any) => {
    // Use different schema based on user role
    const schema =
      req.user?.role === "owner"
        ? updateOwnerProfileSchema
        : updateStaffProfileSchema;
    const middleware = validate(schema);
    return middleware(req, res, next);
  },
  ctrl.updateProfile
);
router.patch(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  ctrl.changePassword
);
router.patch(
  "/staff/:id/reset-password",
  requireAuth,
  requireOwner,
  validate(resetPasswordSchema),
  ctrl.resetStaffPassword
);
router.get("/users", requireAuth, requireRole("owner"), ctrl.list);
router.patch(
  "/users/:id/disable",
  requireAuth,
  requireRole("owner"),
  ctrl.disable
);

export default router;
