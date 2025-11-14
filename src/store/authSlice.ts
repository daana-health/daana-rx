import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, Clinic } from '../types';

const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

interface AuthState {
  user: User | null;
  clinic: Clinic | null;
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  lastActivity: number | null;
}

const initialState: AuthState = {
  user: null,
  clinic: null,
  token: null,
  expiresAt: null,
  isAuthenticated: false,
  hasHydrated: false,
  lastActivity: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: User; clinic: Clinic; token: string }>) => {
      const now = Date.now();
      const expiresAt = now + TWO_HOURS_IN_MS;

      state.user = action.payload.user;
      state.clinic = action.payload.clinic;
      state.token = action.payload.token;
      state.expiresAt = expiresAt;
      state.lastActivity = now;
      state.isAuthenticated = true;
      state.hasHydrated = true;

      // Store token in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
        localStorage.setItem('clinic', JSON.stringify(action.payload.clinic));
        localStorage.setItem('authExpiresAt', expiresAt.toString());
        localStorage.setItem('lastActivity', now.toString());
      }
    },
    refreshActivity: (state) => {
      const now = Date.now();
      state.lastActivity = now;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastActivity', now.toString());
      }
    },
    logout: (state) => {
      state.user = null;
      state.clinic = null;
      state.token = null;
      state.expiresAt = null;
      state.lastActivity = null;
      state.isAuthenticated = false;
      state.hasHydrated = true;

      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('clinic');
        localStorage.removeItem('authExpiresAt');
        localStorage.removeItem('lastActivity');
      }
    },
    restoreAuth: (state) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        const userStr = localStorage.getItem('user');
        const clinicStr = localStorage.getItem('clinic');
        const expiresAtStr = localStorage.getItem('authExpiresAt');
        const lastActivityStr = localStorage.getItem('lastActivity');
        const expiresAt = expiresAtStr ? Number.parseInt(expiresAtStr, 10) : null;
        const lastActivity = lastActivityStr ? Number.parseInt(lastActivityStr, 10) : null;

        const isValid =
          !!token &&
          !!userStr &&
          !!clinicStr &&
          typeof expiresAt === 'number' &&
          Number.isFinite(expiresAt) &&
          expiresAt > Date.now();

        if (isValid) {
          state.token = token!;
          state.user = JSON.parse(userStr!);
          state.clinic = JSON.parse(clinicStr!);
          state.expiresAt = expiresAt!;
          state.lastActivity = lastActivity;
          state.isAuthenticated = true;
        } else {
          if (expiresAt && expiresAt <= Date.now()) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('clinic');
            localStorage.removeItem('authExpiresAt');
            localStorage.removeItem('lastActivity');
          }

          state.user = null;
          state.clinic = null;
          state.token = null;
          state.expiresAt = null;
          state.lastActivity = null;
          state.isAuthenticated = false;
        }

        state.hasHydrated = true;
      }
    },
  },
});

export const { setAuth, logout, restoreAuth, refreshActivity } = authSlice.actions;
export default authSlice.reducer;
export type { RootState } from './index';
