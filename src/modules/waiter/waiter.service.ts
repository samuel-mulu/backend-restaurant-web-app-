import { Types } from "mongoose";
import { OrderStatus } from "../orders/order.model";
import * as orderService from "../orders/order.service";
import * as salaryService from "../salary/salary.service";

export type WaiterListFilters = {
  status?: OrderStatus | OrderStatus[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
};

const staffIdOf = (salary: { staffId?: unknown }): string => {
  const staff = salary.staffId as
    | string
    | { _id?: unknown; id?: unknown }
    | undefined;
  if (!staff) return "";
  if (typeof staff === "string") return staff;
  return String(staff._id ?? staff.id ?? "");
};

export const getMySummary = async (
  waiterId: string,
  waiterName: string,
  filters: Omit<WaiterListFilters, "page" | "limit"> = {}
) => {
  const summary = await orderService.getOrdersByWaiterSummary(
    waiterId,
    filters
  );
  const averageOrderValue =
    summary.totalOrders > 0 ? summary.totalAmount / summary.totalOrders : 0;

  return {
    waiterId,
    waiterName,
    totalOrders: summary.totalOrders,
    totalAmount: summary.totalAmount,
    averageOrderValue,
    byStatus: summary.byStatus,
  };
};

export const getMyOrders = async (
  waiterId: string,
  filters: WaiterListFilters = {}
) => {
  return orderService.listOrders({
    ...filters,
    waiterId,
    page: filters.page || 1,
    limit: filters.limit || 20,
  });
};

export const getMySalary = async (
  waiterId: string,
  month?: number,
  year?: number
) => {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const monthStr = `${y}-${String(m).padStart(2, "0")}`;

  const result = await salaryService.listSalaries({
    staffId: waiterId,
    month: monthStr,
    year: y,
    limit: 1,
  });

  return {
    salary: result.salaries[0] ?? null,
    month: monthStr,
    year: y,
  };
};

export const assertOwnSalary = async (salaryId: string, waiterId: string) => {
  if (!Types.ObjectId.isValid(salaryId)) {
    throw { status: 404, message: "Salary record not found" };
  }

  const salary = await salaryService.getSalaryById(salaryId);
  if (!salary) {
    throw { status: 404, message: "Salary record not found" };
  }

  if (staffIdOf(salary) !== waiterId) {
    throw { status: 403, message: "You can only access your own salary" };
  }

  return salary;
};

export const getMySalaryById = async (salaryId: string, waiterId: string) => {
  return assertOwnSalary(salaryId, waiterId);
};

export const getMyCountdown = async (salaryId: string, waiterId: string) => {
  await assertOwnSalary(salaryId, waiterId);
  return salaryService.calculateCountdown(salaryId);
};

export const getMyWithdrawals = async (salaryId: string, waiterId: string) => {
  await assertOwnSalary(salaryId, waiterId);
  return salaryService.listWithdrawals(salaryId);
};

export const getMyPayments = async (salaryId: string, waiterId: string) => {
  await assertOwnSalary(salaryId, waiterId);
  return salaryService.listPayments(salaryId);
};
