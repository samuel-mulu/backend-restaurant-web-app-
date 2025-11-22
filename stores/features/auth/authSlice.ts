import { RootState } from "@/stores";
import { User } from "@/types/auth";
import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ accessToken: string; user: User }>
    ) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.hydrated = true;
    },

    setToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = Boolean(action.payload && state.user);
    },

    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
    },

    logout: (state) => {
      state.accessToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.hydrated = true;
    },

    markHydrated: (state) => {
      state.hydrated = true;
    },
  },
});

export const { setCredentials, setToken, setUser, logout, markHydrated } =
  authSlice.actions;

export const selectIsAuthenticated = (state: RootState) =>
  state.auth.isAuthenticated;
export const selectUser = (state: RootState) => state.auth.user;
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectAuthHydrated = (state: RootState) => state.auth.hydrated;

export default authSlice.reducer;
