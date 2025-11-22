import { createApiEndpoints } from "@/stores/baseApi";

// Type definitions
export type UserStatus = "active" | "suspended";

export type UserRole = "admin" | "customer" | "superadmin";

export interface Branch {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  status: "active" | "inactive";
}

export interface Admin {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: Date;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  suspensionReason?: string;
  activatedAt?: Date;
  branches?: Branch[];
}

export interface GetAdminsQuery {
  includeBranches?: boolean;
}

export interface AdminsResponse {
  success: boolean;
  message: string;
  data: Admin[];
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  // Profile information
  gender?: "male" | "female" | "prefer_not_to_say";
  birthday?: string;
  loyaltyPoints?: number;
  // Order statistics from backend
  totalOrders: number;
  completedOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderTime: string | null;
  // Optional fields
  suspendedAt?: string;
  suspensionReason?: string;
  activatedAt?: string;
}

// Enhanced customer detail types
export interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  averagePerMonth: number;
  monthOverMonthChange: number;
  changeAmount: number;
  cancelledOrders: number;
  cancelledChange: number;
}

export interface SpendingStats {
  totalSpent: number;
  thisMonthSpent: number;
  lastMonthSpent: number;
  monthOverMonthChange: number;
  changeAmount: number;
}

export interface LoyaltyPoints {
  available: number;
  earned: number;
  nextRewardIn: number;
  progress: number;
  rewardMilestone: number;
}

export interface FavoriteProduct {
  productId: string;
  orderCount: number;
  totalQuantity: number;
  product: {
    id: string;
    name: string;
    image: { url: string; public_id: string };
    description: string;
    SKU: number;
    unit: string;
    sizes: Array<{ label: string; price: number }>;
    series: string;
  };
}

export interface RecentOrder {
  id: string;
  orderId: string;
  status: string;
  statusBadge: string;
  items: string;
  itemsCount: number;
  itemsArray: Array<{
    productId: string;
    productName: string;
    quantity: number;
    size: string;
    itemPrice: number;
    image: any;
  }>;
  dateTime: string;
  createdAt: string;
  pickupTime: string;
  store: {
    id: string;
    name: string;
    location: { lat: number; lng: number };
    address?: string;
  } | null;
  total: number;
  payment: {
    status: string;
    method: string;
  };
}

export interface CustomerDetail {
  // Basic Information
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: UserStatus;
  memberSince: string;
  lastPurchase: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
  suspensionReason?: string;
  activatedAt?: string;

  // Profile Details
  profile: {
    gender?: string;
    birthday?: string;
    dietaryRestrictions?: string[];
    allergies?: string[];
    allergyCount?: number;
  };

  // Order Statistics
  orderStats: OrderStats;

  // Spending Analytics
  spendingStats: SpendingStats;

  // Loyalty Points
  loyaltyPoints: LoyaltyPoints;

  // Top 3 Favorite Products
  favoriteProducts: FavoriteProduct[];

  // Recent Orders (Last 5)
  recentOrders: RecentOrder[];
}

// Customer Orders Query Parameters
export interface CustomerOrdersParams {
  page?: number;
  limit?: number;
  status?: string; // Order status (pending, completed, cancelled, etc.)
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Order in list
export interface CustomerOrder {
  id: string;
  orderId: string;
  status: string;
  statusBadge: string;
  items: string;
  itemsCount: number;
  itemsArray: any[];
  dateTime: string;
  createdAt: string;
  pickupTime: string;
  store: {
    id: string;
    name: string;
    location: any;
    address?: string;
  } | null;
  total: number;
  payment: {
    status: string;
    method: string;
  };
}

export interface CustomerOrdersResponse {
  success: boolean;
  message: string;
  data: CustomerOrder[];
  pagination: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CustomersResponse {
  success: boolean;
  message: string;
  data: Customer[];
  pagination: PaginationMeta;
  meta?: {
    total: number;
    withOrders: number;
    withoutOrders: number;
  };
}

export const usersApi = createApiEndpoints({
  endpoints: (build) => ({
    getAdmins: build.query<AdminsResponse, GetAdminsQuery | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.includeBranches) {
          params.set("includeBranches", "true");
        }

        const qs = params.toString();
        return {
          url: `/users/admins${qs ? `?${qs}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((admin) => ({
                type: "Admin" as const,
                id: admin.id,
              })),
              { type: "Admin" as const, id: "LIST" },
            ]
          : [{ type: "Admin" as const, id: "LIST" }],
      keepUnusedDataFor: 60,
    }),

    updateAdminStatus: build.mutation<
      { success: boolean; message: string; data: Admin },
      { id: string; status: UserStatus; suspensionReason?: string }
    >({
      query: ({ id, status, suspensionReason }) => ({
        url: `/users/${id}/status`,
        method: "PATCH",
        body: { status, suspensionReason },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Admin", id },
        { type: "Admin", id: "LIST" },
      ],
    }),

    deleteAdmin: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/users/admins/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Admin", id: "LIST" }],
    }),

    restoreAdmin: build.mutation<
      { success: boolean; message: string; data: Admin },
      string
    >({
      query: (id) => ({
        url: `/users/admins/${id}/restore`,
        method: "PATCH",
      }),
      invalidatesTags: [{ type: "Admin", id: "LIST" }],
    }),

    createAdmin: build.mutation<
      { success: boolean; message: string; data: Admin },
      {
        fullName: string;
        email?: string;
        phoneNumber: string;
        password: string;
        status?: UserStatus;
      }
    >({
      query: (body) => ({
        url: `/users/admins`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Admin", id: "LIST" }],
    }),

    // Customer endpoints
    getCustomers: build.query<CustomersResponse, PaginationParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set("page", params.page.toString());
        if (params?.limit) searchParams.set("limit", params.limit.toString());
        if (params?.search) searchParams.set("search", params.search);
        if (params?.status) searchParams.set("status", params.status);

        const qs = searchParams.toString();
        return `/users/customers${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({
                type: "Customer" as const,
                id,
              })),
              { type: "Customer", id: "LIST" },
            ]
          : [{ type: "Customer", id: "LIST" }],
    }),

    updateCustomerStatus: build.mutation<
      { success: boolean; message: string; data: Customer },
      { id: string; status: UserStatus; suspensionReason?: string }
    >({
      query: ({ id, status, suspensionReason }) => ({
        url: `/users/${id}/status`,
        method: "PATCH",
        body: { status, suspensionReason },
      }),
      // Invalidate all customer queries on status update
      // This will refetch the current page and update the cache
      invalidatesTags: (result, error, { id }) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),

    getCustomerById: build.query<
      { success: boolean; message: string; data: CustomerDetail },
      string
    >({
      query: (id) => `/users/customers/${id}`,
      providesTags: (result, error, id) => [{ type: "Customer", id }],
    }),

    getCustomerOrders: build.query<
      CustomerOrdersResponse,
      { customerId: string; params?: CustomerOrdersParams }
    >({
      query: ({ customerId, params }) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set("page", params.page.toString());
        if (params?.limit) searchParams.set("limit", params.limit.toString());
        if (params?.status) searchParams.set("status", params.status);
        if (params?.startDate) searchParams.set("startDate", params.startDate);
        if (params?.endDate) searchParams.set("endDate", params.endDate);
        if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
        if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

        const qs = searchParams.toString();
        return `/users/${customerId}/orders${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result, error, { customerId }) => [
        { type: "Customer", id: customerId },
        { type: "Order", id: "LIST" },
      ],
    }),
  }),
});

export const {
  // Admin hooks
  useGetAdminsQuery,
  useUpdateAdminStatusMutation,
  useDeleteAdminMutation,
  useRestoreAdminMutation,
  useCreateAdminMutation,
  // Customer hooks
  useGetCustomersQuery,
  useUpdateCustomerStatusMutation,
  useGetCustomerByIdQuery,
  useGetCustomerOrdersQuery,
} = usersApi;
