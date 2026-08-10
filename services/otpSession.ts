// Holds the password in memory only (never in route params/URL/history) so
// the OTP screen can silently re-trigger /auth/login for a "resend code"
// action without the user retyping their password.
let pending: { email: string; password: string } | null = null;

export function setPendingLogin(email: string, password: string) {
  pending = { email, password };
}

export function getPendingLogin() {
  return pending;
}

export function clearPendingLogin() {
  pending = null;
}
