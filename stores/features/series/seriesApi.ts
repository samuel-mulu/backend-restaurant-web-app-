import { createApiEndpoints } from "@/stores/baseApi";
import type { Series, ApiListResponse } from "@/types/series";

type CreateSeriesBody = {
  name: string;
  isActive?: boolean;
  order?: number;
};
type UpdateSeriesBody = {
  name?: string;
  isActive?: boolean;
  order?: number;
};

export const seriesApi = createApiEndpoints({
  endpoints: (b) => ({
    listSeries: b.query<
      ApiListResponse<Series[]>,
      { includeInactive?: boolean } | void
    >({
      query: (arg) => {
        const includeInactive = arg?.includeInactive ? "1" : "0";
        return { url: `series?includeInactive=${includeInactive}` };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((s) => ({
                type: "Series" as const,
                id: s.id,
              })),
              { type: "Series" as const, id: "LIST" },
            ]
          : [{ type: "Series" as const, id: "LIST" }],
    }),

    createSeries: b.mutation<ApiListResponse<Series>, CreateSeriesBody>({
      query: (body) => ({ url: "series", method: "POST", body }),
      invalidatesTags: [{ type: "Series", id: "LIST" }],
    }),

    updateSeries: b.mutation<
      ApiListResponse<Series>,
      { id: string; body: UpdateSeriesBody }
    >({
      query: ({ id, body }) => ({ url: `series/${id}`, method: "PUT", body }),
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        // Optimistically update the cache
        const patchResult = dispatch(
          seriesApi.util.updateQueryData(
            "listSeries",
            { includeInactive: true },
            (draft: ApiListResponse<Series[]>) => {
              const seriesIndex = draft.data.findIndex(
                (s: Series) => s.id === id
              );
              if (seriesIndex !== -1) {
                Object.assign(draft.data[seriesIndex], body);
              }
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: "Series", id: arg.id },
        { type: "Series", id: "LIST" },
      ],
    }),

    deactivateSeries: b.mutation<ApiListResponse<Series>, { id: string }>({
      query: ({ id }) => ({ url: `series/${id}/deactivate`, method: "PATCH" }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        // Optimistically update the cache
        const patchResult = dispatch(
          seriesApi.util.updateQueryData(
            "listSeries",
            { includeInactive: true },
            (draft: ApiListResponse<Series[]>) => {
              const seriesIndex = draft.data.findIndex(
                (s: Series) => s.id === id
              );
              if (seriesIndex !== -1) {
                draft.data[seriesIndex].isActive = false;
              }
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: "Series", id: arg.id },
        { type: "Series", id: "LIST" },
      ],
    }),

    restoreSeries: b.mutation<ApiListResponse<Series>, { id: string }>({
      query: ({ id }) => ({ url: `series/${id}/restore`, method: "PATCH" }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        // Optimistically update the cache
        const patchResult = dispatch(
          seriesApi.util.updateQueryData(
            "listSeries",
            { includeInactive: true },
            (draft: ApiListResponse<Series[]>) => {
              const seriesIndex = draft.data.findIndex(
                (s: Series) => s.id === id
              );
              if (seriesIndex !== -1) {
                draft.data[seriesIndex].isActive = true;
              }
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: "Series", id: arg.id },
        { type: "Series", id: "LIST" },
      ],
    }),

    reorderSeries: b.mutation<
      ApiListResponse<Series[]>,
      { items: Array<{ id: string; order: number }> }
    >({
      query: (body) => ({ url: "series/reorder", method: "POST", body }),
      async onQueryStarted({ items }, { dispatch, queryFulfilled }) {
        // Optimistically update the cache
        const patchResult = dispatch(
          seriesApi.util.updateQueryData(
            "listSeries",
            { includeInactive: true },
            (draft: ApiListResponse<Series[]>) => {
              items.forEach(({ id, order }) => {
                const seriesIndex = draft.data.findIndex(
                  (s: Series) => s.id === id
                );
                if (seriesIndex !== -1) {
                  draft.data[seriesIndex].order = order;
                }
              });
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
      invalidatesTags: [{ type: "Series", id: "LIST" }],
    }),

    toggleSeriesStatus: b.mutation<ApiListResponse<Series>, { id: string }>({
      query: ({ id }) => ({
        url: `series/${id}/toggle-status`,
        method: "PATCH",
      }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        // Optimistically update the cache
        const patchResult = dispatch(
          seriesApi.util.updateQueryData(
            "listSeries",
            { includeInactive: true },
            (draft: ApiListResponse<Series[]>) => {
              const seriesIndex = draft.data.findIndex(
                (s: Series) => s.id === id
              );
              if (seriesIndex !== -1) {
                draft.data[seriesIndex].isActive =
                  !draft.data[seriesIndex].isActive;
              }
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          // Rollback on error
          patchResult.undo();
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: "Series", id: arg.id },
        { type: "Series", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListSeriesQuery,
  useCreateSeriesMutation,
  useUpdateSeriesMutation,
  useDeactivateSeriesMutation,
  useRestoreSeriesMutation,
  useReorderSeriesMutation,
  useToggleSeriesStatusMutation,
} = seriesApi;
