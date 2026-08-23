import api, { clearToken, saveToken } from './api';

export type NotificationChannel = 'EMAIL' | 'SMS';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumber?: string;
  profilePicture?: string;
  /** General notification delivery channel(s) — booking confirmations, OTP
   * codes, reminders. Always at least one value; API rejects an empty list. */
  notificationChannels?: NotificationChannel[];
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
 * Public pre-check used by sign-up forms (register-host, etc.) so a
 * duplicate email can be caught right after the guest types it in, instead
 * of only at final submit after they've already filled out property
 * details and KYC uploads. The backend still enforces uniqueness
 * independently at submit either way — this is purely a faster-feedback
 * UX check, not a security boundary.
 */
export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await api.get<{ exists: boolean }>('/users/check-email', {
    params: { email },
  });
  return data.exists;
}

/** React Native's FormData file shape — {uri, name, type}, not a web Blob/File object. */
export type PickedFile = { uri: string; name: string; type: string };

export type HostKycFiles = {
  businessLicense?: PickedFile;
  idProof?: PickedFile;
  ownershipProof?: PickedFile;
};

function appendKycFiles(form: FormData, kyc?: HostKycFiles) {
  if (!kyc) return;
  (Object.entries(kyc) as [keyof HostKycFiles, PickedFile | undefined][]).forEach(
    ([key, file]) => {
      if (file) form.append(key, file as any);
    },
  );
}

/**
 * Register a brand-new host account (not yet logged in). The account is
 * created with role 'host' and status 'pending' — an admin must approve it
 * before the host can sign in and manage properties. Sent as multipart/
 * form-data since KYC documents (optional) are real file uploads.
 *
 * The API's validation schema for this endpoint is `.strict()` and only
 * recognizes the fields typed below — anything else (property type, room
 * count, etc.) gets the whole request rejected, so those never get sent
 * here even though the mobile wizard collects them for the review screen.
 */
export async function registerHost(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  country?: string;
  hotelName?: string;
  kyc?: HostKycFiles;
}): Promise<{ id: number; email: string }> {
  const { kyc, ...fields } = payload;
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value) form.append(key, value);
  });
  appendKycFiles(form, kyc);
  const { data } = await api.post('/users/host-registration', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Lets an already-authenticated (logged-in) guest apply to become a host
 * without creating a duplicate account. Requires auth token (attached
 * automatically by the api interceptor). Unlike `registerHost`, this
 * endpoint's schema does accept `agreedDocumentIds`, so legal consent
 * genuinely persists on this path.
 */
export async function applyForHost(payload: {
  hotelName?: string;
  phoneNumber?: string;
  kyc?: HostKycFiles;
  agreedDocumentIds?: number[];
}): Promise<AuthUser> {
  const { kyc, agreedDocumentIds, ...fields } = payload;
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value) form.append(key, value);
  });
  appendKycFiles(form, kyc);
  if (agreedDocumentIds?.length) {
    form.append('agreedDocumentIds', JSON.stringify(agreedDocumentIds));
  }
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
 * Update the authenticated user's basic profile fields and/or notification
 * channel preference. Fields left undefined are left untouched server-side
 * (Prisma ignores undefined keys on partial update), so callers can send
 * just `notificationChannels` without re-sending name/phone.
 */
export async function updateMe(payload: {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  notificationChannels?: NotificationChannel[];
}): Promise<AuthUser> {
  const { data } = await api.put<AuthUser>('/users/me', payload);
  return data;
}
