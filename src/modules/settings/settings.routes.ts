import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/authMiddleware";
import * as settingsCtrl from "./settings.controller";

const router = Router();

router.use(requireAuth);

/** Public app settings for owner + cashier (no PIN secrets) */
router.get(
  "/",
  requireRole("owner", "cashier"),
  settingsCtrl.getSettings
);

router.get(
  "/security-pins",
  requireRole("owner"),
  settingsCtrl.getSecurityPins
);

router.put(
  "/security-pins",
  requireRole("owner"),
  settingsCtrl.updateSecurityPins
);

router.put(
  "/cashier-permissions",
  requireRole("owner"),
  settingsCtrl.updateCashierPermissions
);

router.post(
  "/security-pins/verify",
  requireRole("owner", "cashier"),
  settingsCtrl.verifySecurityPin
);

export default router;
