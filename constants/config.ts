import { Platform } from 'react-native';

// Use 10.0.2.2 for Android emulator (maps to host machine localhost)
const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

// Base host (no path) — used to build image URLs, etc.
export const API_HOST =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ??
  `http://${LOCALHOST}:5001`;

// All siyago-api routes are mounted under /api/v1
export const API_URL = `${API_HOST}/api/v1`;

// The marketing/web app — used for legal pages (Terms, Privacy) and the
// Help Center. Set EXPO_PUBLIC_WEBSITE_URL for a release build; matches
// siyago-ui's own local default of localhost:3000 otherwise.
export const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'http://localhost:3000';

export const APP_NAME = 'Siyago';
