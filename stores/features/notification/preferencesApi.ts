/**
 * Notification Preferences API
 * RTK Query endpoints for managing user notification preferences
 */

import { createApiEndpoints } from "@/stores/baseApi";

// Notification Preferences Type (matching backend)
export interface NotificationPreferences {
  id: string;
  userId: string;
  enabled: boolean; // Master switch
  quietMode: boolean; // Silent mode (no sound)
  orderNotifications: boolean; // Order notifications
  paymentNotifications: boolean; // Payment notifications
  soundEnabled: boolean; // Sound enabled
  soundUrl?: string; // Custom sound URL
  quietHoursStart?: string; // Quiet hours start (ISO string)
  quietHoursEnd?: string; // Quiet hours end (ISO string)
  createdAt: string;
  updatedAt: string;
}

// Update Preferences Payload
export interface UpdateNotificationPreferencesPayload {
  enabled?: boolean;
  quietMode?: boolean;
  orderNotifications?: boolean;
  paymentNotifications?: boolean;
  soundEnabled?: boolean;
  soundUrl?: string;
  quietHoursStart?: string; // ISO date string or Date
  quietHoursEnd?: string; // ISO date string or Date
}

// Response Types
export interface NotificationPreferencesResponse {
  success: boolean;
  message: string;
  data: NotificationPreferences;
}

export const preferencesApi = createApiEndpoints({
  endpoints: (build) => ({
    // Get notification preferences for current user
    getNotificationPreferences: build.query<
      NotificationPreferencesResponse,
      void
    >({
      query: () => ({
        url: "/notification-preferences",
        method: "GET",
      }),
      providesTags: ["NotificationPreferences"],
    }),

    // Update notification preferences for current user
    updateNotificationPreferences: build.mutation<
      NotificationPreferencesResponse,
      UpdateNotificationPreferencesPayload
    >({
      query: (data) => ({
        url: "/notification-preferences",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["NotificationPreferences"],
      // Update cache optimistically
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          // Update cache with new preferences
          dispatch(
            preferencesApi.util.updateQueryData(
              "getNotificationPreferences",
              undefined,
              (draft: any) => {
                Object.assign(draft, {
                  success: data.success,
                  message: data.message,
                  data: data.data,
                });
              }
            )
          );
        } catch (error) {
          // Error handling
        }
      },
    }),
  }),
});

export const {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useLazyGetNotificationPreferencesQuery,
} = preferencesApi;
