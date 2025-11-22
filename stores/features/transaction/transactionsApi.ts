import { createApiEndpoints } from "@/stores/baseApi";

// Transaction Status - matches backend payment model exactly
export type TransactionStatus = "paid" | "unpaid" | "failed";

// Payment Method - matches backend payment model exactly
export type PaymentMethod = "telbirr" | "mobilebanking" | "card" | null;

export type TransactionCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type TransactionStore = {
  id: string;
  name: string;
  address: string;
  city?: string;
};

export type Transaction = {
  id: string;
  transactionNumber: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  fee: number;
  netAmount: number;
  customer: TransactionCustomer;
  orderNumber: string;
  orderId: string;
  store: TransactionStore;
  date: string;
  description: string;
  referenceCode?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GetTransactionsQuery = {
  status?: TransactionStatus | "all";
  storeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

export type TransactionsResponse = {
  success: boolean;
  message: string;
  data: Transaction[];
  pagination: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  meta: {
    total: number;
  };
};

export type TransactionResponse = {
  success: boolean;
  message: string;
  data: Transaction;
};

export type TransactionStats = {
  totalRevenue: number;
  totalTransactions: number;
  totalRefunds: number;
  totalFees: number;
  successRate: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
};

export type TransactionStatsResponse = {
  success: boolean;
  message: string;
  data: TransactionStats;
};

export const transactionsApi = createApiEndpoints({
  endpoints: (build) => ({
    getAllTransactions: build.query<
      TransactionsResponse,
      GetTransactionsQuery | void
    >({
      query: (args) => {
        const params = new URLSearchParams();

        if (args?.status && args.status !== "all") {
          params.set("status", args.status);
        }
        if (args?.storeId && args.storeId !== "all") {
          params.set("storeId", args.storeId);
        }
        if (args?.search) {
          params.set("search", args.search);
        }
        if (args?.startDate) {
          params.set("startDate", args.startDate);
        }
        if (args?.endDate) {
          params.set("endDate", args.endDate);
        }
        if (args?.page) {
          params.set("page", String(args.page));
        }
        if (args?.limit) {
          params.set("limit", String(args.limit));
        }

        const qs = params.toString();
        const endpoint = `/transactions${qs ? `?${qs}` : ""}`;

        return {
          url: endpoint,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((t) => ({
                type: "Transaction" as const,
                id: t.id,
              })),
              { type: "Transaction" as const, id: "LIST" },
            ]
          : [{ type: "Transaction" as const, id: "LIST" }],
      keepUnusedDataFor: 60,
    }),

    getTransactionById: build.query<TransactionResponse, string>({
      query: (id) => ({
        url: `/transactions/${id}`,
        method: "GET",
      }),
      providesTags: (result, _err, id) => [{ type: "Transaction", id }],
    }),

    getTransactionStats: build.query<
      TransactionStatsResponse,
      { storeId?: string; startDate?: string; endDate?: string } | void
    >({
      query: (args) => {
        const params = new URLSearchParams();

        if (args?.storeId && args.storeId !== "all") {
          params.set("storeId", args.storeId);
        }
        if (args?.startDate) {
          params.set("startDate", args.startDate);
        }
        if (args?.endDate) {
          params.set("endDate", args.endDate);
        }

        const qs = params.toString();
        const endpoint = `/transactions/stats${qs ? `?${qs}` : ""}`;

        return {
          url: endpoint,
          method: "GET",
        };
      },
      providesTags: [{ type: "Transaction", id: "STATS" }],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const {
  useGetAllTransactionsQuery,
  useGetTransactionByIdQuery,
  useGetTransactionStatsQuery,
} = transactionsApi;
