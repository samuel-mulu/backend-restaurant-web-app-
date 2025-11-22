import { createApiEndpoints } from "@/stores/baseApi";

// User type (from backend user model)
export type User = {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
};

// Store type (from backend store model)
export type Store = {
  _id: string;
  name: string;
  address: string;
  location?: {
    type: string;
    coordinates: number[];
  };
};

// Product type (from backend product model)
export type ProductInfo = {
  _id: string;
  name: string;
  image: {
    url: string;
    public_id: string;
  };
  sizes: {
    label: string;
    price: number;
  }[];
};

// Payment type (from backend payment model)
export type Payment = {
  _id: string;
  paymentStatus: "paid" | "unpaid" | "failed";
  method: string;
  amount: number;
  retryCount?: number;
};

// Order Item (matching backend structure)
export type OrderItem = {
  product: ProductInfo;
  size?: string;
  quantity: number;
  price?: number;
  itemPrice: number;
  toppings?: string[];
  allergyCheck?: string[];
  unit?: string;
  customizations?: string[];
  _id?: string;
};

// Order status (matching backend)
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

// Order type (matching backend response structure with renamed fields)
export type Order = {
  _id: string;
  orderNumber?: string;
  user: User;
  store: Store;
  items: OrderItem[];
  status: OrderStatus;
  payment?: Payment;
  total: number;
  subtotal?: number;
  tax?: number;
  pickupTime?: string;
  actualPickupTime?: string;
  specialInstructions?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  confirmedAt?: string;
  preparingAt?: string;
  createdAt: string;
  updatedAt: string;
};

// Pagination type
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

// Order statistics type
export type OrderStatistics = {
  total: number;
  pending: number;
  confirmed: number;
  preparing: number;
  ready_for_pickup: number;
  completed: number;
  cancelled: number;
};

// Orders response type
export type OrdersResponse = {
  success: boolean;
  message: string;
  data: Order[];
  statistics: OrderStatistics;
  pagination: Pagination;
  responseTime?: number;
};

// Single order response type
export type OrderResponse = {
  success: boolean;
  message: string;
  data: Order;
};

// Get orders query parameters
export type GetOrdersQuery = {
  page?: number;
  limit?: number;
  status?: string;
  storeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  timeRange?: "today" | "7days" | "30days" | "90days" | "all";
  sort?: string;
};

// Update order status payload
export type UpdateOrderStatusPayload = {
  status: OrderStatus;
};

// Tracking data response
export type TrackingData = {
  orderId: string;
  status: OrderStatus;
  trackingMessage: string;
  isActive: boolean;
  pickupTime?: string;
  total: number;
  store: Store;
  items: OrderItem[];
  payment?: Payment;
  actualPickupTime?: string;
  user: User;
  createdAt: string;
  updatedAt: string;
};

export type TrackingResponse = {
  success: boolean;
  message: string;
  data: TrackingData;
};

// Live orders response (no pagination, no statistics)
export type LiveOrdersResponse = {
  success: boolean;
  message: string;
  data: Order[];
  total: number;
  responseTime?: number;
};

// Live orders query parameters
export type GetLiveOrdersQuery = {
  storeId?: string;
};

// Admin orders response (with pagination)
export type AdminOrdersResponse = {
  success: boolean;
  message: string;
  data: Order[];
  // Top-level total number of matching orders (all pages)
  total?: number;
  pagination: Pagination;
  responseTime?: number;
};

export type GetAdminOrdersQuery = {
  page?: number;
  limit?: number;
  status?: string;
  storeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
};

export const ordersApi = createApiEndpoints({
  endpoints: (build) => ({
    // ===== ADMIN ENDPOINTS =====

    // Get live orders for Kanban board (admin)
    getLiveOrders: build.query<LiveOrdersResponse, GetLiveOrdersQuery | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.storeId) params.set("storeId", args.storeId);

        const qs = params.toString();
        return {
          url: `/admin/orders/live${qs ? `?${qs}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((order) => ({
                type: "Order" as const,
                id: order._id,
              })),
              { type: "Order" as const, id: "LIVE_LIST" },
            ]
          : [{ type: "Order" as const, id: "LIVE_LIST" }],
      keepUnusedDataFor: 5, // Keep fresh data for kanban board
      // Note: Polling removed - using Socket.IO real-time updates instead
    }),

    // Update order status (admin)
    updateOrderStatusAdmin: build.mutation<
      OrderResponse,
      { id: string; data: UpdateOrderStatusPayload }
    >({
      query: ({ id, data }) => ({
        url: `/admin/orders/${id}/status`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIVE_LIST" },
      ],
    }),

    // Get admin orders (history)
    getAdminOrders: build.query<
      AdminOrdersResponse,
      GetAdminOrdersQuery | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.status) params.set("status", args.status);
        if (args?.storeId) params.set("storeId", args.storeId);
        if (args?.search) params.set("search", args.search);
        if (args?.startDate) params.set("startDate", args.startDate);
        if (args?.endDate) params.set("endDate", args.endDate);
        if (args?.sort) params.set("sort", args.sort);

        const qs = params.toString();
        return {
          url: `/admin/orders${qs ? `?${qs}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((order) => ({
                type: "Order" as const,
                id: order._id,
              })),
              { type: "Order" as const, id: "ADMIN_LIST" },
            ]
          : [{ type: "Order" as const, id: "ADMIN_LIST" }],
    }),

    // ===== SUPERADMIN ENDPOINTS =====

    // Get all orders (superadmin)
    getAllOrders: build.query<OrdersResponse, GetOrdersQuery | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.status) params.set("status", args.status);
        // Always set storeId to ensure proper cache invalidation
        if (args?.storeId !== undefined) params.set("storeId", args.storeId);
        if (args?.search) params.set("search", args.search);
        if (args?.startDate) params.set("startDate", args.startDate);
        if (args?.endDate) params.set("endDate", args.endDate);
        if (args?.timeRange) params.set("timeRange", args.timeRange);
        if (args?.sort) params.set("sort", args.sort);

        const qs = params.toString();
        return {
          url: `/superadmin/orders${qs ? `?${qs}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((order) => ({
                type: "Order" as const,
                id: order._id,
              })),
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order" as const, id: "LIST" }],
      keepUnusedDataFor: 30,
    }),

    // Get order by ID
    getOrderById: build.query<OrderResponse, string>({
      query: (id) => ({
        url: `/superadmin/orders/${id}`,
        method: "GET",
      }),
      providesTags: (result, _err, id) => [{ type: "Order", id }],
    }),

    // Update order status
    updateOrderStatus: build.mutation<
      OrderResponse,
      { id: string; data: UpdateOrderStatusPayload }
    >({
      query: ({ id, data }) => ({
        url: `/superadmin/orders/${id}/status`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, _err, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    // Delete order (soft delete)
    deleteOrder: build.mutation<OrderResponse, string>({
      query: (id) => ({
        url: `/superadmin/orders/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, _err, id) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),

    // Track order
    trackOrder: build.query<TrackingResponse, string>({
      query: (id) => ({
        url: `/superadmin/orders/${id}/track`,
        method: "GET",
      }),
      providesTags: (result, _err, id) => [{ type: "Order", id }],
    }),
  }),
});

export const {
  // Admin hooks
  useGetLiveOrdersQuery,
  useUpdateOrderStatusAdminMutation,
  useGetAdminOrdersQuery,

  // Superadmin hooks
  useGetAllOrdersQuery,
  useGetOrderByIdQuery,
  useUpdateOrderStatusMutation,
  useDeleteOrderMutation,
  useTrackOrderQuery,
  useLazyGetOrderByIdQuery,
  useLazyTrackOrderQuery,
} = ordersApi;
