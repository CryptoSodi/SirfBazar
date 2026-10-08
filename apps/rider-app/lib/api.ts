import { friendlyError } from './friendly-error';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Defaults to the live production API. Local backend: EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3001/api */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.sirfbazar.com/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const KEYS = { access: 'sbm.accessToken', refresh: 'sbm.refreshToken', user: 'sbm.user' };
let authVersion = 0;
export const getAuthVersion = () => authVersion;

export async function getUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export async function isLoggedIn(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(KEYS.access));
}

/** Persist tokens only — used by the silent refresh path (no push side-effects). */
async function persistAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  await AsyncStorage.multiSet([
    [KEYS.access, data.accessToken],
    [KEYS.refresh, data.refreshToken],
    [KEYS.user, JSON.stringify(data.user)],
  ]);
}

export async function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  authVersion++;
  await persistAuth(data);
}

export async function clearAuth() {
  const version = ++authVersion;
  // Stop alerts to this device while the token is still valid.
  await import('./push').then((m) => m.unregisterPush()).catch(() => undefined);
  const refreshToken = await AsyncStorage.getItem(KEYS.refresh);
  if (refreshToken) await request('POST', '/auth/logout', { refreshToken }, false).catch(() => undefined);
  if (version === authVersion) await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh, KEYS.user]);
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const access = await AsyncStorage.getItem(KEYS.access);
  if (access) headers.authorization = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && access && retry) {
    const generation = authVersion;
    const refreshToken = await AsyncStorage.getItem(KEYS.refresh);
    if (refreshToken) {
      try {
        const r = await fetch(`${API_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (r.ok) {
          // persistAuth (not storeAuth): a background refresh must never trigger
          // push re-registration — that races the logout flow's token removal.
          const refreshed = await r.json();
          if (generation !== authVersion) throw new ApiError('Session changed. Sign in again.', 401);
          await persistAuth(refreshed);
          return request(method, path, body, false);
        }
      } catch {
        /* fall through */
      }
    }
    if (generation !== authVersion) throw new ApiError('Session changed. Sign in again.', 401);
    await clearAuth();
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = friendlyError(data?.message, res.status, path, data?.code);
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  get: (p: string) => request('GET', p),
  post: (p: string, b?: unknown) => request('POST', p, b),
  put: (p: string, b?: unknown) => request('PUT', p, b),
  del: (p: string) => request('DELETE', p),
};

/** After /rider/apply returns fresh tokens, persist them + the user profile. */
export async function finishOnboarding(tokens: { accessToken: string; refreshToken: string }) {
  authVersion++;
  await AsyncStorage.multiSet([
    [KEYS.access, tokens.accessToken],
    [KEYS.refresh, tokens.refreshToken],
  ]);
  const user = await request('GET', '/auth/me');
  await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  return user;
}

export function pkr(paisa: number | null | undefined): string {
  return `Rs ${Math.round((paisa ?? 0) / 100).toLocaleString()}`;
}

export function statusLabel(status: string): string {
  return (status ?? '').replace(/_/g, ' ').toLowerCase();
}
