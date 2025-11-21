import { Router } from "express";
import * as ctrl from "./item.controller";

import { uploadImageMiddleware } from "../../common/middleware/upload";

const router = Router();

// public
router.get("/", ctrl.list);
// admin - specific routes must come before parameterized routes
router.get("/deleted", ctrl.getDeleted);
router.get("/unavailable", ctrl.getUnavailable);
router.get("/:id", ctrl.get);

// admin
router.post("/", uploadImageMiddleware.single("image"), ctrl.create as any);
router.patch("/:id", uploadImageMiddleware.single("image"), ctrl.update as any);
router.delete("/:id", ctrl.remove);
router.patch("/:id/restore", ctrl.restore);
router.delete(
  "/:id/permanent",

  ctrl.permanentDelete
);
router.patch("/:id/availability", ctrl.availability);

export default router;
