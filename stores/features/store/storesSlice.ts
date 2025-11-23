import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "@/stores";
import { Store } from "./storesApi";

interface StoresState {
  stores: Store[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: StoresState = {
  stores: [],
  isLoading: false,
  error: null,
  lastFetched: null,
};

const storesSlice = createSlice({
  name: "stores",
  initialState,
  reducers: {
    setStores: (state, action: PayloadAction<Store[]>) => {
      state.stores = action.payload;
      state.isLoading = false;
      state.error = null;
      state.lastFetched = Date.now();
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearStores: (state) => {
      state.stores = [];
      state.isLoading = false;
      state.error = null;
      state.lastFetched = null;
    },
  },
});

// Actions
export const { setStores, setLoading, setError, clearStores } =
  storesSlice.actions;

// Selectors
export const selectAllStores = (state: RootState) => state.stores.stores;
export const selectStoresLoading = (state: RootState) => state.stores.isLoading;
export const selectStoresError = (state: RootState) => state.stores.error;
export const selectStoresLastFetched = (state: RootState) =>
  state.stores.lastFetched;

export const selectStoreById = (state: RootState, storeId: string) =>
  state.stores.stores.find((store) => store.id === storeId);

// Memoized selector for active stores
export const selectActiveStores = (state: RootState) =>
  state.stores.stores.filter((store) => store.status === "active");

export default storesSlice.reducer;
