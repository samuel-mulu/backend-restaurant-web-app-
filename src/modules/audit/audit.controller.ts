import { Request, Response, NextFunction } from "express";
import * as auditService from "./audit.service";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      entityType: req.query.entityType as any,
      entityId: req.query.entityId as string,
      performedBy: req.query.performedBy as string,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    // If user is not owner, only show their own actions
    if (req.user?.role !== "owner" && req.user?._id) {
      filters.performedBy = req.user._id;
    }

    const result = await auditService.listAudits(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getByEntity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { entityType, entityId } = req.params;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: "Entity type and ID are required",
      });
    }

    const audits = await auditService.getAuditsByEntity(
      entityType as any,
      entityId
    );

    res.status(200).json({
      success: true,
      data: audits,
    });
  } catch (err) {
    next(err);
  }
};

export const getByUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.params.userId || req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // If user is not owner, only show their own actions
    if (req.user?.role !== "owner" && userId !== req.user?._id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const audits = await auditService.getAuditsByUser(userId);

    res.status(200).json({
      success: true,
      data: audits,
    });
  } catch (err) {
    next(err);
  }
};
