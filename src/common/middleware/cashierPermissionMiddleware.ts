import { NextFunction, Request, Response } from "express";
import {
  assertCashierCanEdit,
  CashierResource,
} from "../../modules/settings/settings.service";

/**
 * After requireAuth (+ optional requireRole), block cashier mutations
 * when the owner has disabled edit/delete for that resource.
 * Owners always pass.
 */
export function requireCashierResourceAccess(resource: CashierResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await assertCashierCanEdit(req.user?.role, resource);
      next();
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }
      console.error("Cashier resource access check failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to verify permissions",
      });
    }
  };
}
