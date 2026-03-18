import { Request, Response } from "express";
import * as expenseService from "./expense.service";

export const createExpense = async (req: Request, res: Response) => {
  try {
    const expense = await expenseService.createExpense({
      ...req.body,
      expenseType: req.body.expenseType || "cash",
      createdBy: (req as any).user._id,
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, staffId, expenseType } = req.query;
    const expenses = await expenseService.getExpenses({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      staffId: staffId as string,
      expenseType: expenseType as "cash" | "mobile_banking" | undefined,
    });
    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await expenseService.deleteExpense(id);
    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
