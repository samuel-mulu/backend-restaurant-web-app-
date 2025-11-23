/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApiEndpoints } from "@/stores/baseApi";

export type TransactionStatus = "paid" | "unpaid" | "failed";

export type RecentTransaction = {
  transactionId: string;
  referenceCode: string;
  paymentMethod: string;
  paymentStatus: TransactionStatus;
  paidAt?: string;
  amount: number;
  orderNumber: string;
  customerName: string;
  storeName: string;
  orderDate: string;
  itemCount: number;
};

export const transactionsApi = createApiEndpoints({
  endpoints: (b) => ({
    getRecentTransactions: b.query<
      {
        success: boolean;
        page: number;
        limit: number;
        total: number;
        count: number;
        transactions: RecentTransaction[];
        pagination?: {
          total: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      },
      { page?: number; limit?: number; status?: TransactionStatus } | void
    >({
      query: (args) => {
        const {
          page = 1,
          limit = 10,
          status,
        } = (args || {}) as {
          page?: number;
          limit?: number;
          status?: TransactionStatus;
        };

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (status) params.set("status", status);

        return {
          url: `statistics/recent-transactions?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Transaction"],
    }),
  }),
});

export const { useGetRecentTransactionsQuery } = transactionsApi;
