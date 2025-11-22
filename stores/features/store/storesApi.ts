import { createApiEndpoints } from "@/stores/baseApi";
import { setStores, setLoading, setError } from "./storesSlice";

type StoreLocation = { lat: number; lng: number };
export type StoreImage = { url: string; public_id: string; _id: string };
type StoreAdmin = {
  _id: string;
  email: string;
  id: string;
  name?: string;
  phone?: string;
};

export type Store = {
  _id: string;
  id: string;
  name: string;
  address: string;
  location: StoreLocation;
  images: StoreImage[];
  admins: StoreAdmin[];
  createdAt: string;
  updatedAt: string;
  status?: "active" | "inactive";
  city?: string;
  isDeleted?: boolean;
};

export type GetStoresQuery = {
  includeDeleted?: boolean;
  status?: "active" | "inactive";
  search?: string;
};

export type StoresResponse = {
  success: boolean;
  message: string;
  data: Store[];
  totalItems?: number;
};

export type StoreResponse = {
  success: boolean;
  message: string;
  data: Store;
};

export const storesApi = createApiEndpoints({
  endpoints: (build) => ({
    getAllStores: build.query<StoresResponse, GetStoresQuery | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (typeof args?.includeDeleted !== "undefined") {
          params.set("includeDeleted", String(args.includeDeleted));
        }
        if (args?.status) {
          params.set("status", args.status);
        }
        if (args?.search) {
          params.set("search", args.search);
        }

        const qs = params.toString();
        const endpoint = `/superadmin/stores${qs ? `?${qs}` : ""}`;

        return {
          url: endpoint,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((s) => ({
                type: "Store" as const,
                id: s.id,
              })),
              { type: "Store" as const, id: "LIST" },
            ]
          : [{ type: "Store" as const, id: "LIST" }],
      keepUnusedDataFor: 60,
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        dispatch(setLoading(true));
        try {
          const { data } = await queryFulfilled;
          if (data?.success && data.data) {
            dispatch(setStores(data.data));
          } else {
            // Handle case where query succeeds but returns unsuccessful response
            dispatch(setError(data?.message || "Failed to fetch stores"));
          }
        } catch (error: any) {
          // Handle network errors, CORS errors, etc.
          const errorMessage =
            error?.error?.data?.message ||
            error?.error?.message ||
            error?.message ||
            "Failed to fetch stores. Please check your connection.";
          dispatch(setError(errorMessage));
        }
      },
    }),

    // Admin endpoint - Get stores assigned to the logged-in admin
    getAdminStores: build.query<StoresResponse, void>({
      query: () => ({
        url: "/admin/stores",
        method: "GET",
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((s) => ({
                type: "Store" as const,
                id: s.id,
              })),
              { type: "Store" as const, id: "ADMIN_LIST" },
            ]
          : [{ type: "Store" as const, id: "ADMIN_LIST" }],
      keepUnusedDataFor: 60,
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        dispatch(setLoading(true));
        try {
          const { data } = await queryFulfilled;
          if (data?.success && data.data) {
            dispatch(setStores(data.data));
          } else {
            dispatch(setError(data?.message || "Failed to fetch stores"));
          }
        } catch (error: any) {
          // Handle network errors, CORS errors, etc.
          const errorMessage =
            error?.error?.data?.message ||
            error?.error?.message ||
            error?.message ||
            "Failed to fetch stores. Please check your connection.";
          dispatch(setError(errorMessage));
        }
      },
    }),

    getStoreById: build.query<StoreResponse, string>({
      query: (id) => ({
        url: `/superadmin/stores/${id}`,
        method: "GET",
      }),
      providesTags: (result, _err, id) => [{ type: "Store", id }],
    }),

    createStore: build.mutation<
      StoreResponse,
      {
        name: string;
        address: string;
        city?: string;
        location: StoreLocation;
        adminIds: string[];
        status?: "active" | "inactive";
        images?: File[];
      }
    >({
      query: (body) => {
        const formData = new FormData();
        formData.append("name", body.name);
        formData.append("address", body.address);
        if (body.city) formData.append("city", body.city);
        formData.append("location", JSON.stringify(body.location));
        if (body.status) formData.append("status", body.status);
        if (body.adminIds?.length) {
          formData.append("adminIds", JSON.stringify(body.adminIds));
        }

        if (body.images) {
          body.images.forEach((image) => {
            formData.append("images", image);
          });
        }

        return {
          url: "/superadmin/stores",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: [{ type: "Store", id: "LIST" }],
    }),

    updateStore: build.mutation<
      StoreResponse,
      {
        id: string;
        name?: string;
        address?: string;
        city?: string;
        location?: StoreLocation;
        status?: "active" | "inactive";
        adminIds?: string[];
        images?: File[];
        existingImages?: StoreImage[];
      }
    >({
      query: ({ id, ...body }) => {
        console.log("update store data :", body);
        const formData = new FormData();
        if (body.name) formData.append("name", body.name);
        if (body.address) formData.append("address", body.address);
        if (body.city) formData.append("city", body.city);
        if (body.status) formData.append("status", body.status);
        if (body.location) {
          formData.append("location", JSON.stringify(body.location));
        }
        if (body.adminIds !== undefined) {
          formData.append("adminIds", JSON.stringify(body.adminIds));
        }

        // Send existing images that should be kept (even if empty array for proper deletion handling)
        if (body.existingImages !== undefined) {
          formData.append(
            "existingImages",
            JSON.stringify(body.existingImages)
          );
        }

        // Send new image files
        if (body.images) {
          body.images.forEach((image) => {
            formData.append("images", image);
          });
        }

        return {
          url: `/superadmin/stores/${id}`,
          method: "PUT",
          body: formData,
        };
      },
      invalidatesTags: (_result, _err, { id }) => [
        { type: "Store", id },
        { type: "Store", id: "LIST" },
      ],
    }),

    deleteStore: build.mutation<StoreResponse, string>({
      query: (id) => ({
        url: `/superadmin/stores/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _err, id) => [
        { type: "Store", id },
        { type: "Store", id: "LIST" },
      ],
    }),

    restoreStore: build.mutation<StoreResponse, string>({
      query: (id) => ({
        url: `/superadmin/stores/${id}/restore`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, id) => [
        { type: "Store", id },
        { type: "Store", id: "LIST" },
      ],
    }),

    assignAdminsToStore: build.mutation<
      StoreResponse,
      { storeId: string; adminIds: string[] }
    >({
      query: ({ storeId, adminIds }) => ({
        url: `/superadmin/stores/${storeId}/assign-admins`,
        method: "PUT",
        body: { adminIds },
      }),
      invalidatesTags: (_result, _err, { storeId }) => [
        { type: "Store", id: storeId },
        { type: "Store", id: "LIST" },
      ],
    }),

    toggleStoreStatus: build.mutation<StoreResponse, string>({
      query: (id) => ({
        url: `/superadmin/stores/${id}/toggle-status`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, id) => [
        { type: "Store", id },
        { type: "Store", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetAllStoresQuery,
  useGetAdminStoresQuery,
  useGetStoreByIdQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useDeleteStoreMutation,
  useRestoreStoreMutation,
  useAssignAdminsToStoreMutation,
  useToggleStoreStatusMutation,
} = storesApi;
