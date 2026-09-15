import {
  formatDateLocal,
  parseEndOfDay,
  parseStartOfDay,
} from "../../common/utils/dateUtils";
import { Request, Response } from "express";
import * as reportService from "./report.service";
import { ReportItemType } from "./report.service";

const parseStatusQuery = (statusParam: unknown): string[] | undefined => {
  if (!statusParam || typeof statusParam !== "string") return undefined;
  const statuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return statuses.length > 0 ? statuses : undefined;
};

const parseItemType = (itemTypeParam: unknown): ReportItemType | undefined => {
  if (itemTypeParam === "menu" || itemTypeParam === "inventory") {
    return itemTypeParam;
  }
  return undefined;
};

const parseExpenseType = (
  expenseType: unknown,
): "cash" | "mobile_banking" | undefined =>
  expenseType === "cash" || expenseType === "mobile_banking"
    ? expenseType
    : undefined;

export const getDailyReport = async (req: Request, res: Response) => {
  try {
    const { date, status, expenseType, itemType } = req.query;
    const dateStr =
      date && typeof date === "string" ? date : formatDateLocal(new Date());
    const statusFilter = parseStatusQuery(status);

    const startDate = parseStartOfDay(dateStr);
    const endDate = parseEndOfDay(dateStr);

    const report = await reportService.getReportData(
      startDate,
      endDate,
      statusFilter,
      parseExpenseType(expenseType),
      parseItemType(itemType),
    );
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMonthlyReport = async (req: Request, res: Response) => {
  try {
    const { year, month, status, expenseType, itemType } = req.query;
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
      parseExpenseType(expenseType),
      parseItemType(itemType),
    );
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getRangeReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, expenseType, itemType } = req.query;

    if (
      !startDate ||
      !endDate ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required and must be valid dates",
      });
    }

    const parsedStartDate = parseStartOfDay(startDate);
    const parsedEndDate = parseEndOfDay(endDate);

    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json({
        success: false,
        message: "startDate must be on or before endDate",
      });
    }

    const report = await reportService.getReportData(
      parsedStartDate,
      parsedEndDate,
      parseStatusQuery(status),
      parseExpenseType(expenseType),
      parseItemType(itemType),
    );
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getStaffOrderDetails = async (req: Request, res: Response) => {
  try {
    const {
      staffType,
      staffId,
      startDate,
      endDate,
      status,
      paymentMethod,
      itemType,
    } = req.query;

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

    if (
      !startDate ||
      !endDate ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required and must be valid dates",
      });
    }

    const parsedStartDate = parseStartOfDay(startDate);
    const parsedEndDate = parseEndOfDay(endDate);

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
      itemType: parseItemType(itemType),
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
