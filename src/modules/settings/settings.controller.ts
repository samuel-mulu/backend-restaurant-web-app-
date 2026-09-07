import { Request, Response } from "express";
import * as settingsService from "./settings.service";

export const getSettings = async (_req: Request, res: Response) => {
  try {
    const data = await settingsService.getPublicSettings();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error getting settings:", error);
    res.status(500).json({ success: false, message: "Failed to get settings" });
  }
};

export const getSecurityPins = async (_req: Request, res: Response) => {
  try {
    const status = await settingsService.getPublicSettings();
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error("Error getting security pins:", error);
    res.status(500).json({ success: false, message: "Failed to get security PIN status" });
  }
};

export const updateSecurityPins = async (req: Request, res: Response) => {
  try {
    const { voidPin, expensePin } = req.body;
    const status = await settingsService.updateSecurityPins({
      voidPin,
      expensePin,
    });
    res.json({
      success: true,
      data: status,
      message: "Security PINs updated successfully",
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Error updating security pins:", error);
    res.status(500).json({ success: false, message: "Failed to update security PINs" });
  }
};

export const updateCashierPermissions = async (req: Request, res: Response) => {
  try {
    const data = await settingsService.updateCashierPermissions(req.body);

    res.json({
      success: true,
      data,
      message: "Cashier settings updated successfully",
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Error updating cashier permissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cashier settings",
    });
  }
};

export const verifySecurityPin = async (req: Request, res: Response) => {
  try {
    const { type, pin } = req.body;

    if (type !== "void" && type !== "expense") {
      return res.status(400).json({
        success: false,
        message: "type must be 'void' or 'expense'",
      });
    }

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required",
      });
    }

    const ok = await settingsService.verifySecurityPin(type, String(pin));
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Invalid security PIN",
        data: { valid: false },
      });
    }

    res.json({ success: true, data: { valid: true } });
  } catch (error: any) {
    console.error("Error verifying security pin:", error);
    res.status(500).json({ success: false, message: "Failed to verify security PIN" });
  }
};
