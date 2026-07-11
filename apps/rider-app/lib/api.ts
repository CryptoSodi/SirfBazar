import AsyncStorage from '@react-native-async-storage/async-storage';

/** Defaults to the live production API. Local backend: EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3001/api */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.sirfbazar.com/api';

const KEYS = { access: 'sbm.accessToken', refresh: 'sbm.refreshToken', user: 'sbm.user' };

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
  await persistAuth(data);
  // Register this device for order alerts (dynamic import avoids an api↔push cycle).
  void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
}

export async function clearAuth() {
  // Stop alerts to this device while the token is still valid.
  await import('./push').then((m) => m.unregisterPush()).catch(() => undefined);
  await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh, KEYS.user]);
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
          await persistAuth(await r.json());
          return request(method, path, body, false);
        }
      } catch {
        /* fall through */
      }
    }
    await clearAuth();
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
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
  await AsyncStorage.multiSet([
    [KEYS.access, tokens.accessToken],
    [KEYS.refresh, tokens.refreshToken],
  ]);
  const user = await request('GET', '/auth/me');
  await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
  return user;
}

export function pkr(paisa: number | null | undefined): string {
  return `Rs ${Math.round((paisa ?? 0) / 100).toLocaleString()}`;
}

export function statusLabel(status: string): string {
  return (status ?? '').replace(/_/g, ' ').toLowerCase();
}
