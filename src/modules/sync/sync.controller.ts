import { Request, Response, NextFunction } from "express";
import * as syncService from "./sync.service";

export const sync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        message: "Operations must be an array",
      });
    }

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Operations array cannot be empty",
      });
    }

    // Limit batch size
    if (operations.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Maximum 100 operations per batch",
      });
    }

    const performedBy = req.user?._id;
    if (!performedBy) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await syncService.processSync(operations, performedBy);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

