import { createApiEndpoints } from "@/stores/baseApi";

export type ProductSize = {
  label: string;
  price: number;
};

export type ProductImage = {
  url: string;
  public_id: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  image: ProductImage;
  SKU?: number;
  sizes: ProductSize[];
  unit: string;
  series: string;
  ingredients?: string[];
  isFastingFriendly: boolean;
  toppings?: string[];
  preparationTime?: number;
};

export type StoreProduct = {
  id: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  product: Product;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  images: Array<{
    url: string;
    public_id: string;
    _id: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type StoreProductsResponse = {
  success: boolean;
  message: string;
  pagination: Pagination;
  store: Store;
  data: StoreProduct[];
};

export type GetStoreProductsQuery = {
  storeId: string;
  page?: number;
  limit?: number;
  search?: string;
  isAvailable?: boolean;
  sort?: string;
  // Optional series filter (series ID)
  series?: string;
};

export type ToggleAvailabilityPayload = {
  storeId: string;
  productId: string;
};

export const storeProductsApi = createApiEndpoints({
  endpoints: (build) => ({
    getStoreProducts: build.query<StoreProductsResponse, GetStoreProductsQuery>(
      {
        query: ({ storeId, ...args }) => {
          const params = new URLSearchParams();
          if (args.page) params.set("page", String(args.page));
          if (args.limit) params.set("limit", String(args.limit));
          if (args.search) params.set("search", args.search);
          if (typeof args.isAvailable !== "undefined") {
            params.set("isAvailable", String(args.isAvailable));
          }
          if (args.sort) params.set("sort", args.sort);
          if (args.series) params.set("series", args.series);

          const qs = params.toString();
          return {
            url: `/admin/store-products/${storeId}${qs ? `?${qs}` : ""}`,
            method: "GET",
          };
        },
        providesTags: (result, _error, { storeId }) =>
          result?.data
            ? [
                ...result.data.map((sp) => ({
                  type: "StoreProduct" as const,
                  id: sp.id,
                })),
                { type: "StoreProduct" as const, id: `LIST-${storeId}` },
              ]
            : [{ type: "StoreProduct" as const, id: `LIST-${storeId}` }],
        keepUnusedDataFor: 60,
      }
    ),

    toggleProductAvailability: build.mutation<
      { success: boolean; message: string; data: StoreProduct },
      ToggleAvailabilityPayload
    >({
      query: ({ storeId, productId }) => ({
        url: `/admin/store-products/${storeId}/${productId}/toggle-availability`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, { storeId, productId }) => [
        { type: "StoreProduct", id: productId },
        { type: "StoreProduct", id: `LIST-${storeId}` },
      ],
    }),
  }),
});

export const {
  useGetStoreProductsQuery,
  useToggleProductAvailabilityMutation,
} = storeProductsApi;
