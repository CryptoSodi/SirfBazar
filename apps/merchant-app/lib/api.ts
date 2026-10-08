import { friendlyError } from './friendly-error';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authDestination, type AuthContext } from './auth-flow';

/** Defaults to the live production API. Local backend: EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3001/api */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.sirfbazar.com/api';

const KEYS = { access: 'sbm.accessToken', refresh: 'sbm.refreshToken', user: 'sbm.user', context: 'sbm.authContext' };
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

export async function storeAuth(data: { accessToken: string; refreshToken: string; user: any }, context: AuthContext = 'merchant') {
  authVersion++;
  await AsyncStorage.setItem(KEYS.context, context);
  await persistAuth(data);
  // Register this device for order alerts (dynamic import avoids an api↔push cycle).
  if (context === 'merchant') void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
}

export async function getEntryRoute(): Promise<'Login' | 'Tabs' | 'Onboard'> {
  if (!(await isLoggedIn())) return 'Login';
  const context = await AsyncStorage.getItem(KEYS.context);
  return authDestination(await getUser(), context === 'customer' ? 'customer' : 'merchant');
}

export async function clearAuth() {
  const version = ++authVersion;
  // Stop alerts to this device while the token is still valid.
  await import('./push').then((m) => m.unregisterPush()).catch(() => undefined);
  const refreshToken = await AsyncStorage.getItem(KEYS.refresh);
  if (refreshToken) await request('POST', '/auth/logout', { refreshToken }, false).catch(() => undefined);
  if (version === authVersion) await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh, KEYS.user, KEYS.context]);
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
          if (generation !== authVersion) throw new Error('Session changed. Sign in again.');
          await persistAuth(refreshed);
          return request(method, path, body, false);
        }
      } catch {
        /* fall through */
      }
    }
    if (generation !== authVersion) throw new Error('Session changed. Sign in again.');
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

/** Upload an image (multipart) and get back its public URL. */
export async function uploadImage(uri: string): Promise<string> {
  const access = await AsyncStorage.getItem(KEYS.access);
  const name = uri.split('/').pop() || 'photo.jpg';
  const extRaw = (name.split('.').pop() || 'jpg').toLowerCase();
  const type = `image/${extRaw === 'jpg' ? 'jpeg' : extRaw}`;
  const form = new FormData();
  form.append('file', { uri, name, type } as any);
  const res = await fetch(`${API_URL}/uploads/image`, {
    method: 'POST',
    headers: access ? { authorization: `Bearer ${access}` } : {},
    body: form as any,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) throw new Error(friendlyError(data?.message, res.status, '/uploads/image'));
  return data.url as string;
}

/** After /merchant/onboard returns fresh tokens, persist them + the user profile. */
export async function finishOnboarding(tokens: { accessToken: string; refreshToken: string; user?: any }) {
  authVersion++;
  await AsyncStorage.multiSet([
    [KEYS.access, tokens.accessToken],
    [KEYS.refresh, tokens.refreshToken],
    [KEYS.context, 'merchant'],
  ]);
  const user = tokens.user ?? await request('GET', '/auth/me');
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
