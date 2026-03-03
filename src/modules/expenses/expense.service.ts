import { Types } from "mongoose";
import { Expense, ExpenseDoc } from "./expense.model";

export const createExpense = async (data: Partial<ExpenseDoc>): Promise<ExpenseDoc> => {
  return await Expense.create(data);
};

export const getExpenses = async (filters: {
  startDate?: Date;
  endDate?: Date;
  staffId?: string;
}): Promise<ExpenseDoc[]> => {
  const query: any = {};

  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) query.date.$gte = filters.startDate;
    if (filters.endDate) query.date.$lte = filters.endDate;
  }

  if (filters.staffId) {
    query.staffId = new Types.ObjectId(filters.staffId);
  }

  return await Expense.find(query).sort({ date: -1 }).populate("staffId", "name role");
};

export const deleteExpense = async (id: string): Promise<ExpenseDoc | null> => {
  return await Expense.findByIdAndDelete(id);
};
