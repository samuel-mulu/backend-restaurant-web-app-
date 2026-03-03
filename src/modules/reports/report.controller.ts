import { Request, Response } from "express";
import * as reportService from "./report.service";

const parseStatusQuery = (
  statusParam: unknown,
): string[] | undefined => {
  if (!statusParam || typeof statusParam !== "string") return undefined;
  const statuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return statuses.length > 0 ? statuses : undefined;
};

const parseDateQuery = (value: unknown): Date | undefined => {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const getDailyReport = async (req: Request, res: Response) => {
  try {
    const { date, status } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const statusFilter = parseStatusQuery(status);
    
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const report = await reportService.getReportData(
      startDate,
      endDate,
      statusFilter,
    );
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMonthlyReport = async (req: Request, res: Response) => {
  try {
    const { year, month, status } = req.query; // Expecting strings
    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) - 1 : now.getMonth();
    const statusFilter = parseStatusQuery(status);

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const report = await reportService.getReportData(
      startDate,
      endDate,
      statusFilter,
    );
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getStaffOrderDetails = async (req: Request, res: Response) => {
  try {
    const { staffType, staffId, startDate, endDate, status, paymentMethod } =
      req.query;

    if (staffType !== "waiter" && staffType !== "cashier") {
      return res.status(400).json({
        success: false,
        message: "staffType must be 'waiter' or 'cashier'",
      });
    }

    if (!staffId || typeof staffId !== "string") {
      return res.status(400).json({
        success: false,
        message: "staffId is required",
      });
    }

    const parsedStartDate = parseDateQuery(startDate);
    const parsedEndDate = parseDateQuery(endDate);
    if (!parsedStartDate || !parsedEndDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required and must be valid dates",
      });
    }

    parsedStartDate.setHours(0, 0, 0, 0);
    parsedEndDate.setHours(23, 59, 59, 999);

    const statuses = parseStatusQuery(status);
    const normalizedPaymentMethod =
      typeof paymentMethod === "string" && paymentMethod !== "ALL"
        ? paymentMethod
        : undefined;

    const data = await reportService.getStaffOrderDetails({
      staffType,
      staffId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      statuses,
      paymentMethod: normalizedPaymentMethod,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
