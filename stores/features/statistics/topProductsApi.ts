/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApiEndpoints } from "@/stores/baseApi";

export type TopProduct = {
  productId: string;
  name: string;
  sku: string;
  image?: string; // Backend returns image.url as a string
  totalQuantitySold: number;
  totalRevenue: number;
};

export type TopProductsResponse = {
  success: boolean;
  count: number;
  sortBy: "totalQuantitySold" | "totalRevenue";
  range: {
    start: string;
    end: string;
  };
  products: TopProduct[];
};

export const topProductsApi = createApiEndpoints({
  endpoints: (b) => ({
    getTopProducts: b.query<
      TopProductsResponse,
      {
        limit?: number;
        sortBy?: "totalQuantitySold" | "totalRevenue";
        storeId?: string;
      } | void
    >({
      query: (args) => {
        const limit = (args as any)?.limit ?? 5;
        const sortBy = (args as any)?.sortBy ?? "totalRevenue";
        const storeId = (args as any)?.storeId;

        const params = new URLSearchParams();
        if (limit) params.set("limit", String(limit));
        if (sortBy)
          params.set(
            "sortBy",
            sortBy === "totalRevenue" ? "revenue" : "quantity"
          );
        if (storeId) params.set("storeId", storeId);

        return {
          url: `statistics/top-products?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Overview"],
    }),
  }),
});

export const { useGetTopProductsQuery } = topProductsApi;
