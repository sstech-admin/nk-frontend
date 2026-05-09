/**
 * Auth storage keys and token access for API requests.
 */

export const AUTH_USER_KEY = "auth_user";
export const AUTH_TOKEN_KEY = "auth_token";
/** Date (YYYY-MM-DD) when user logged in; session is valid only for that calendar day. */
export const AUTH_LOGIN_DAY_KEY = "auth_login_day";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/** Callback when 401 Unauthorized - triggers logout. AuthProvider registers this. */
let on401: (() => void) | null = null;

export function registerOn401(callback: () => void): () => void {
  on401 = callback;
  return () => { on401 = null; };
}

export function dispatch401(): void {
  on401?.();
}
