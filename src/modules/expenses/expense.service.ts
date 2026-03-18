import { Types } from "mongoose";
import { Expense, ExpenseDoc } from "./expense.model";

export const createExpense = async (data: Partial<ExpenseDoc>): Promise<ExpenseDoc> => {
  const payload = {
    ...data,
    expenseType: data.expenseType || "cash",
  };
  return await Expense.create(payload);
};

export const getExpenses = async (filters: {
  startDate?: Date;
  endDate?: Date;
  staffId?: string;
  expenseType?: "cash" | "mobile_banking";
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

  if (filters.expenseType) {
    if (filters.expenseType === "cash") {
      query.$or = [
        { expenseType: { $exists: false } },
        { expenseType: null },
        { expenseType: "cash" },
      ];
    } else {
      query.expenseType = filters.expenseType;
    }
  }

  return await Expense.find(query).sort({ date: -1 }).populate("staffId", "name role");
};

export const deleteExpense = async (id: string): Promise<ExpenseDoc | null> => {
  return await Expense.findByIdAndDelete(id);
};
