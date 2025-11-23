/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApiEndpoints } from "@/stores/baseApi";

type Metric = {
  tags?: string;
  today: {
    amount: number;
    change?: number;
  };
  previous7Days: number;
  previous30Days?: number;
};

export type DashboardMetrics = {
  totalSales: Metric;
  totalOrders: Metric;
  pending: Metric;
  canceled: Metric;
};

export const metricsApi = createApiEndpoints({
  endpoints: (b) => ({
    getTodayMetrics: b.query<
      { success: boolean; data: DashboardMetrics },
      void
    >({
      query: () => ({
        url: "statistics/today-metrics",
        method: "GET",
      }),
      providesTags: ["Overview"],
    }),
  }),
});

export const { useGetTodayMetricsQuery } = metricsApi;
