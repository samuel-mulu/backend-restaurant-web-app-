/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createApi,
  fetchBaseQuery,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import { apiConfig } from "@/config/apiConfig";
import { RootState } from "@/stores";
import { logout, markHydrated } from "@/stores/features/auth/authSlice";

/* -------------------------------------------------------
   ✅ Refresh Mutex
   Prevents multiple concurrent refresh requests.
------------------------------------------------------- */
type MaybePromise<T> = T | PromiseLike<T>;

class RefreshMutex {
  private activePromise: Promise<any> | null = null;

  run<T>(task: () => MaybePromise<T>): Promise<T> {
    if (this.activePromise) return this.activePromise as Promise<T>;
    const promise = Promise.resolve(task()).finally(() => {
      this.activePromise = null;
    });
    this.activePromise = promise;
    return promise;
  }

  // optional helper: wait for activePromise but with timeout to avoid indefinite waiting
  async waitOrTimeout<T>(timeoutMs: number): Promise<T | "timeout"> {
    if (!this.activePromise) return "timeout";
    try {
      return (await Promise.race([
        this.activePromise,
        new Promise<"timeout">((res) =>
          setTimeout(() => res("timeout"), timeoutMs)
        ),
      ])) as any;
    } catch {
      return "timeout";
    }
  }
}

const refreshMutex = new RefreshMutex();

/* -------------------------------------------------------
   ✅ Fetch Timeout Wrapper
------------------------------------------------------- */
function createFetchWithTimeout(timeoutMs: number) {
  return async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };
}

const fetchWithTimeout = createFetchWithTimeout(15000);

/* -------------------------------------------------------
   ✅ Base Query With Token
------------------------------------------------------- */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiConfig.BASE_URL,
  credentials: "include",
  fetchFn: fetchWithTimeout,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth?.accessToken;

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    return headers;
  },
});

/* -------------------------------------------------------
   🔥 FINAL VERSION — Base Query with Auto Reauth
   - Proper network error handling
   - Preserve original args (headers/body) on retry
   - Only call markHydrated for profile endpoints
   - Properly handle refresh responses that return no body (cookie-only)
------------------------------------------------------- */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const url = typeof args === "string" ? args : args.url;

  // First attempt
  let result = await rawBaseQuery(args, api, extraOptions);

  /**
   * Handle low-level network error properly
   * Don't return `{ data: null }` — return an error so RTKQ treats it as a failure.
   */
  if ((result as any)?.error?.status === "FETCH_ERROR") {
    // Only mark hydrated if this was profile-related (avoid marking app hydrated on unrelated network issues)
    if (typeof url === "string" && url.includes("/auth/profile")) {
      api.dispatch(markHydrated());
    }

    return {
      error: {
        status: "FETCH_ERROR",
        data: { message: "Network request failed" },
      },
    } as any;
  }

  // If unauthorized -> try refresh
  if (result.error && result.error.status === 401) {
    // Ensure we have a full FetchArgs object to mutate (and to preserve headers/body)
    const originalArgs: FetchArgs =
      typeof args === "string" ? { url: args } : ({ ...args } as FetchArgs);

    const alreadyRetried = (originalArgs as any)._retry;

    // Prevent infinite loops: if already retried -> force logout
    if (alreadyRetried) {
      api.dispatch(logout());
      if (typeof url === "string" && url.includes("/auth/profile")) {
        api.dispatch(markHydrated());
      }
      return result;
    }

    // Mark as retried
    (originalArgs as any)._retry = true;

    // Deep-clone originalArgs to avoid mutations by fetchBaseQuery internals.
    // Use structuredClone when available for completeness; fallback to JSON clone.
    const cloneArgs = (() => {
      try {
        // @ts-ignore - structuredClone may exist in runtime
        return typeof structuredClone === "function"
          ? structuredClone(originalArgs)
          : JSON.parse(JSON.stringify(originalArgs));
      } catch {
        // Last-resort shallow clone
        return { ...originalArgs };
      }
    })() as FetchArgs;

    // Ensure headers structure exists for retry
    if (!cloneArgs.headers) {
      cloneArgs.headers = {};
    }

    // Attempt refresh. Use mutex to avoid parallel refresh requests.
    const refresh = await refreshMutex.run(() =>
      rawBaseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
        },
        api,
        extraOptions
      )
    );

    // If refresh failed at network or returned an error -> logout
    if (refresh.error) {
      api.dispatch(logout());
      if (typeof url === "string" && url.includes("/auth/profile")) {
        api.dispatch(markHydrated());
      }
      return result;
    }

    // If refresh returned no data (backend used cookie-only refresh and returned empty body),
    // we still want to confirm that cookies were set and retry once.
    if (!refresh.data) {
      // Some backends return 204/empty on success; attempt to retry original request once.
      // But if retry again results in 401 we will force logout due to _retry flag.
      result = await rawBaseQuery(cloneArgs, api, extraOptions);

      // If still unauthorized after retry -> logout
      if (result.error && result.error.status === 401) {
        api.dispatch(logout());
      }

      // Hydrate if this was the profile endpoint
      if (typeof url === "string" && url.includes("/auth/profile")) {
        api.dispatch(markHydrated());
      }

      return result;
    }

    // If refresh returned data, the backend may have returned a new accessToken (or user payload).
    // If your app stores accessToken from the refresh endpoint, handle that in your onQueryStarted handlers
    // or call a dispatched action here to store it (kept out to avoid breaking current logic).

    // Retry original request (preserving headers/body)
    result = await rawBaseQuery(cloneArgs, api, extraOptions);
  }

  // Only mark hydration on profile endpoint to avoid marking app hydrated on every API call
  if (typeof url === "string" && url.includes("/auth/profile")) {
    api.dispatch(markHydrated());
  }

  return result;
};

/* -------------------------------------------------------
   🔥 The API Slice
------------------------------------------------------- */
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Auth",
    "Customer",
    "Admin",
    "Order",
    "Product",
    "Store",
    "StoreProduct",
    "Series",
    "Transaction",
    "Overview",
    "Notification",
    "Interest",
    "NotificationPreferences",
  ],
  keepUnusedDataFor: 60,
  // refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

/* -------------------------------------------------------
   Helper for Injecting Endpoints
------------------------------------------------------- */
export const createApiEndpoints = (
  config: Omit<
    Parameters<typeof apiSlice.injectEndpoints>[0],
    "overrideExisting"
  >
): any => {
  return apiSlice.injectEndpoints({
    ...config,
    overrideExisting: process.env.NODE_ENV === "development",
  } as any);
};
