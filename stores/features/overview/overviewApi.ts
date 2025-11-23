/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApiEndpoints } from "@/stores/baseApi";

export type StatsCards = {
  salesToday: number;
  ordersToday: number;
  pendingToday: number;
  canceledToday: number;
};

export type TrendsResponse = {
  labels: string[];
  revenue: number[];
  summary: {
    customers: number;
    totalOrders: number;
    totalSales: number;
    canceled: number;
  };
};

export type BestSellingItem = {
  name: string;
  itemId: string;
  price: number;
  imageUrl: string;
};

export type TransactionItem = {
  id: string;
  orderNumber: string;
  customer: string;
  orderDate: string;
  status: "Paid" | "Pending" | "Canceled";
  paymentMethod: "Cash" | "Card" | "Mobile Pay" | "Bank Transfer";
  items: number;
  store: string;
  amount: number;
};

export const overviewApi = createApiEndpoints({
  endpoints: (b) => ({
    getOverviewStats: b.query<
      { success: boolean; data: StatsCards },
      { storeId?: string } | void
    >({
      query: (args) => {
        const storeId = (args as any)?.storeId as string | undefined;
        const url = storeId
          ? `statistics/${storeId}/overview/stats`
          : `statistics/overview/stats`;
        return { url, method: "GET" };
      },
      providesTags: ["Overview"],
    }),

    getOverviewTrends: b.query<
      { success: boolean; data: TrendsResponse },
      {
        storeId?: string;
        range?: "this_week" | "last_week" | "this_month" | "last_month";
      } | void
    >({
      query: (args) => {
        const storeId = (args as any)?.storeId as string | undefined;
        const range = (args as any)?.range as string | undefined;
        const base = storeId
          ? `statistics/${storeId}/overview/trends`
          : `statistics/overview/trends`;
        const url = range ? `${base}?range=${encodeURIComponent(range)}` : base;
        return { url, method: "GET" };
      },
      providesTags: ["Overview"],
    }),

    getOverviewBestSelling: b.query<
      { success: boolean; data: BestSellingItem[] },
      { storeId?: string } | void
    >({
      query: (args) => {
        const storeId = (args as any)?.storeId as string | undefined;
        const url = storeId
          ? `statistics/${storeId}/overview/best-selling`
          : `statistics/overview/best-selling`;
        return { url, method: "GET" };
      },
      providesTags: ["Overview"],
    }),

    getOverviewTransactions: b.query<
      { success: boolean; data: TransactionItem[] },
      { storeId?: string } | void
    >({
      query: (args) => {
        const storeId = (args as any)?.storeId as string | undefined;
        const url = storeId
          ? `statistics/${storeId}/overview/transactions`
          : `statistics/overview/transactions`;
        return { url, method: "GET" };
      },
      providesTags: ["Overview"],
    }),
  }),
});

export const {
  useGetOverviewStatsQuery,
  useGetOverviewTrendsQuery,
  useGetOverviewBestSellingQuery,
  useGetOverviewTransactionsQuery,
} = overviewApi;
