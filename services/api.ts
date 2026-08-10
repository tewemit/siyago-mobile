import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/config';

export const TOKEN_KEY = 'siyago_token';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Attach JWT token from secure storage on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Module-level subscriber for session expiry. AuthContext registers a
// handler on mount (it can't be wired via a normal import since this file
// has no access to React state) so a 401 on an authenticated request can
// clear in-memory user state and redirect to sign-in from anywhere in the app.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const hadToken = !!error?.config?.headers?.Authorization;
    if (error?.response?.status === 401 && hadToken) {
      await clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// Expose a helper so auth screens can set/clear the token
export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export default api;
