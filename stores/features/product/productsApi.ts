import { createApiEndpoints } from "@/stores/baseApi";
import { ProductFormData } from "@/lib/validations/product.validation";

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
  _id: string;
  SKU: number;
  name: string;
  series: string;
  description: string;
  sizes: ProductSize[];
  image: ProductImage;
  ingredients: string[];
  isFastingFriendly: boolean;
  unit: string;
  toppings: string[];
  preparationTime: number;
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

export type ProductsResponse = {
  success: boolean;
  message: string;
  pagination: Pagination;
  data: Product[];
  responseTime: number;
};

export type GetProductsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  series?: string;
  isFastingFriendly?: boolean;
  sort?: string;
  includeDeleted?: boolean;
};

export type CreateProductPayload = ProductFormData & {
  image: File;
};

export type UpdateProductPayload = ProductFormData & {
  image?: File;
};

const buildProductFormData = (
  data: ProductFormData,
  imageFile?: File
): FormData => {
  const formData = new FormData();

  formData.append("SKU", data.SKU.toString());
  formData.append("name", data.name);
  formData.append("series", data.series);
  formData.append("description", data.description);
  formData.append("unit", data.unit);
  formData.append("preparationTime", data.preparationTime.toString());
  formData.append("isFastingFriendly", data.isFastingFriendly.toString());
  formData.append("sizes", JSON.stringify(data.sizes));
  formData.append("ingredients", JSON.stringify(data.ingredients));
  formData.append("toppings", JSON.stringify(data.toppings));

  if (imageFile) {
    formData.append("image", imageFile);
  }

  return formData;
};

export const productsApi = createApiEndpoints({
  endpoints: (build) => ({
    getProducts: build.query<ProductsResponse, GetProductsQuery | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.search) params.set("search", args.search);
        if (args?.series) params.set("series", args.series);
        if (typeof args?.isFastingFriendly !== "undefined") {
          params.set("isFastingFriendly", String(args.isFastingFriendly));
        }
        if (args?.sort) params.set("sort", args.sort);
        if (typeof args?.includeDeleted !== "undefined") {
          params.set("includeDeleted", String(args.includeDeleted));
        }

        const qs = params.toString();
        return {
          url: `/superadmin/products${qs ? `?${qs}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((p) => ({
                type: "Product" as const,
                id: p.id,
              })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
      keepUnusedDataFor: 60,
    }),

    getProductById: build.query<{ success: boolean; data: Product }, string>({
      query: (id) => ({ url: `/superadmin/products/${id}`, method: "GET" }),
      providesTags: (result, _err, id) => [{ type: "Product", id }],
    }),

    createProduct: build.mutation<
      { success: boolean; message: string; data: Product },
      CreateProductPayload
    >({
      query: (data) => ({
        url: "/superadmin/products",
        method: "POST",
        body: buildProductFormData(data, data.image),
      }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    updateProduct: build.mutation<
      { success: boolean; message: string; data: Product },
      { id: string; data: UpdateProductPayload }
    >({
      query: ({ id, data }) => ({
        url: `/superadmin/products/${id}`,
        method: "PATCH",
        body: buildProductFormData(data, data.image),
      }),
      invalidatesTags: (result, _err, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    deleteProduct: build.mutation<
      { success: boolean; message: string },
      string
    >({
      query: (id) => ({
        url: `/superadmin/products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, _err, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    restoreProduct: build.mutation<
      { success: boolean; message: string; data: Product },
      string
    >({
      query: (id) => ({
        url: `/superadmin/products/${id}/restore`,
        method: "PATCH",
      }),
      invalidatesTags: (result, _err, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useRestoreProductMutation,
} = productsApi;
