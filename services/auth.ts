import api, { clearToken, saveToken } from './api';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumber?: string;
  profilePicture?: string;
};

export type LoginResponse = {
  requiresOtp: boolean;
  preAuthToken: string;
  message: string;
};

export type VerifyOtpResponse = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  token: string;
};

/**
 * Step 1 — verify credentials and trigger OTP email.
 * Returns a short-lived preAuthToken used in step 2.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

/**
 * Step 2 — verify OTP code with preAuthToken and receive a JWT.
 */
export async function verifyOtp(
  preAuthToken: string,
  otp: string,
): Promise<VerifyOtpResponse> {
  const { data } = await api.post<VerifyOtpResponse>('/auth/verify-login-otp', {
    preAuthToken,
    otp,
  });
  await saveToken(data.token);
  return data;
}

/**
 * Register a new guest account. The account is created with 'pending'
 * status — the user must verify their email (link sent by the API) before
 * they can sign in. No token is issued at this step.
 */
export async function register(payload: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber: string;
}): Promise<{ id: number; email: string }> {
  const { data } = await api.post('/users', payload);
  return data;
}

/**
 * Register a brand-new host account (not yet logged in). The account is
 * created with role 'host' and status 'pending' — an admin must approve it
 * before the host can sign in and manage properties. Sent as multipart/
 * form-data because the API endpoint also accepts optional KYC file
 * uploads (not collected by this mobile flow yet).
 */
export async function registerHost(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  country?: string;
  hotelName?: string;
}): Promise<{ id: number; email: string }> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value) form.append(key, value);
  });
  const { data } = await api.post('/users/host-registration', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Lets an already-authenticated (logged-in) guest apply to become a host
 * without creating a duplicate account. Requires auth token (attached
 * automatically by the api interceptor).
 */
export async function applyForHost(payload: {
  hotelName?: string;
  phoneNumber?: string;
}): Promise<AuthUser> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value) form.append(key, value);
  });
  const { data } = await api.post('/users/me/host-application', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Sign out — revokes the token server-side and removes it locally.
 */
export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore network/auth errors — we still clear the local token below.
  }
  await clearToken();
}

/**
 * Fetch the authenticated user's profile.
 */
export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/users/me');
  return data;
}

/**
 * Update the authenticated user's basic profile fields.
 */
export async function updateMe(payload: {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}): Promise<AuthUser> {
  const { data } = await api.put<AuthUser>('/users/me', payload);
  return data;
}
