/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApiEndpoints } from "@/stores/baseApi";

export type TrendRange =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

export type TrendPoint = {
  date: string;
  label: string;
  customers: number;
  orders: number;
  sales: number;
  canceled: number;
};

export type DashboardReport = {
  summary: {
    period: "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth";
    totalCustomers: number;
    totalOrders: number;
    totalSales: number;
    totalCanceled: number;
  };
  trend: TrendPoint[];
};

export const trendApi = createApiEndpoints({
  endpoints: (b) => ({
    getTrendReport: b.query<
      { success: boolean; data: DashboardReport },
      { storeId?: string; range?: TrendRange } | void
    >({
      query: (args) => {
        const storeId = (args as any)?.storeId as string | undefined;
        const range = (args as any)?.range as TrendRange | undefined;

        const query = new URLSearchParams();

        if (range) {
          const rangeMap: Record<TrendRange, string> = {
            this_week: "thisWeek",
            last_week: "lastWeek",
            this_month: "thisMonth",
            last_month: "lastMonth",
          };
          query.set("range", rangeMap[range]);
        }

        if (storeId) {
          query.set("storeId", storeId);
        }

        const qs = query.toString();
        const url = qs ? `statistics/trends?${qs}` : "statistics/trends";

        return { url, method: "GET" };
      },
      providesTags: ["Overview"],
    }),
  }),
});

export const { useGetTrendReportQuery } = trendApi;
