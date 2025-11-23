import { logout, markHydrated, setCredentials, setUser } from "./authSlice";
import {
  ApiLoginResponse,
  ApiProfileResponse,
  LoginRequest,
  User,
} from "@/types/auth";
import { createApiEndpoints } from "@/stores/baseApi";

export const authApi = createApiEndpoints({
  endpoints: (b) => ({
    login: b.mutation<ApiLoginResponse, LoginRequest>({
      query: (body) => ({
        url: "auth/admin/login",
        method: "POST",
        body: { ...body },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          console.log("Login API Response:", data);
          if (data?.success && data.data) {
            const u = data.data.user;
            dispatch(
              setUser({
                id: u.id,
                fullName: u.fullName,
                email: u.email,
                phoneNumber: u.phoneNumber,
                role: u.role as "superadmin" | "admin",
                status: u.status,
              })
            );
            dispatch(markHydrated());
          }
        } catch {
          // Error handling is done in the component
        }
      },
      invalidatesTags: ["Auth"],
    }),

    refreshSession: b.mutation<ApiLoginResponse, void>({
      query: () => ({
        url: "auth/refresh",
        method: "POST",
        credentials: "include",
      }),
    }),

    logout: b.mutation<void, void>({
      query: () => ({ url: "auth/logout", method: "POST" }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(logout());
          dispatch(authApi.util.resetApiState());
          dispatch(markHydrated());
        }
      },
      invalidatesTags: ["Auth"],
    }),

    logoutFromAllDevices: b.mutation<
      { success: boolean; message: string; data?: { message: string } },
      void
    >({
      query: () => ({ url: "auth/logout-all-devices", method: "POST" }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(logout());
          dispatch(authApi.util.resetApiState());
          dispatch(markHydrated());
        }
      },
      invalidatesTags: ["Auth"],
    }),

    getProfile: b.query<ApiProfileResponse, void>({
      query: () => ({
        url: "auth/profile",
        method: "GET",
      }),

      transformResponse: (response: unknown): ApiProfileResponse => {
        const typedResponse = response as {
          success?: boolean;
          data?: unknown;
          message?: string;
        };
        if (
          !response ||
          typedResponse.success === false ||
          !typedResponse.data
        ) {
          return {
            success: false,
            message: typedResponse?.message ?? "Unauthenticated",
            data: undefined,
          };
        }
        return response as ApiProfileResponse;
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.success && data.data) {
            const u = data.data;
            dispatch(
              setUser({
                id: u.id,
                fullName: u.fullName,
                email: u.email,
                phoneNumber: u.phoneNumber,
                role: u.role as "superadmin" | "admin",
                status: u.status,
              })
            );
          } else {
            dispatch(setUser(null));
          }
        } catch {
        } finally {
          dispatch(markHydrated());
        }
      },
    }),

    updateProfile: b.mutation<
      { success: boolean; message: string; data?: User },
      { fullName?: string; phoneNumber?: string }
    >({
      query: (body) => ({
        url: "auth/profile",
        method: "PUT",
        body,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (data?.success && data.data) {
          dispatch(setUser(data.data));
        }
      },
      invalidatesTags: ["Auth"],
    }),

    changePassword: b.mutation<
      { success: boolean; message: string },
      {
        currentPassword: string;
        newPassword: string;
        confirmNewPassword: string;
      }
    >({
      query: (body) => ({
        url: "auth/change-password",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),

    requestResetOTP: b.mutation<
      { success: boolean; message: string },
      { emailOrPhone: string }
    >({
      query: (body) => ({
        url: "/forgot-password",
        method: "POST",
        body,
      }),
    }),

    verifyResetOTP: b.mutation<
      {
        success: boolean;
        message: string;
        data?: { resetToken: string; expiresIn: number };
      },
      { emailOrPhone: string; otpCode: string }
    >({
      query: (body) => ({
        url: "auth/verify-otp",
        method: "POST",
        body,
      }),
    }),

    resetPassword: b.mutation<
      { success: boolean; message: string },
      { newPassword: string }
    >({
      query: (body) => ({
        url: "auth/reset-password",
        method: "POST",
        body,
      }),
    }),

    getAdmins: b.query<
      {
        success: boolean;
        message: string;
        data: Array<{
          id: string;
          fullName: string;
          email: string;
          phoneNumber: string;
          role: string;
          status: string;
          createdAt: string;
          updatedAt: string;
        }>;
      },
      void
    >({
      query: () => ({
        url: "user/admins",
      }),
      providesTags: ["Auth"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshSessionMutation,
  useLogoutMutation,
  useLogoutFromAllDevicesMutation,
  useUpdateProfileMutation,
  useGetProfileQuery,
  useChangePasswordMutation,
  useRequestResetOTPMutation,
  useVerifyResetOTPMutation,
  useResetPasswordMutation,
  useGetAdminsQuery,
} = authApi;
