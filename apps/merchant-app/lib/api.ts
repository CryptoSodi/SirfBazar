import { friendlyError } from './friendly-error';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authDestination, type AuthContext } from './auth-flow';
import { invalidateSessionToasts } from './toast-session';

/** Defaults to the live production API. Local backend: EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3001/api */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.sirfbazar.com/api';

const KEYS = { access: 'sbm.accessToken', refresh: 'sbm.refreshToken', user: 'sbm.user', context: 'sbm.authContext' };
let authVersion = 0;
export const getAuthVersion = () => authVersion;
let authWrites: Promise<unknown> = Promise.resolve();
function serializeAuth<T>(work: () => Promise<T>): Promise<T> {
  const operation = authWrites.then(work);
  authWrites = operation.catch(() => undefined);
  return operation;
}
const changed = () => new Error('Your session changed. Sign in again.');

export async function getUser(): Promise<any | null> {
  const version = authVersion;
  return serializeAuth(async () => {
    if (version !== authVersion) return null;
    const raw = await AsyncStorage.getItem(KEYS.user);
    return version === authVersion && raw ? JSON.parse(raw) : null;
  });
}

export async function isLoggedIn(): Promise<boolean> {
  const version = authVersion;
  return serializeAuth(async () => version === authVersion && !!(await AsyncStorage.getItem(KEYS.access)) && version === authVersion);
}

/** Persist tokens only — used by the silent refresh path (no push side-effects). */
async function persistAuth(data: { accessToken: string; refreshToken: string; user: any }, version: number) {
  await serializeAuth(async () => {
    if (version !== authVersion) throw changed();
    await AsyncStorage.multiSet([
    [KEYS.access, data.accessToken],
    [KEYS.refresh, data.refreshToken],
    [KEYS.user, JSON.stringify(data.user)],
    ]);
  });
  if (version !== authVersion) throw changed();
}

export async function storeAuth(data: { accessToken: string; refreshToken: string; user: any }, context: AuthContext = 'merchant') {
  const version = ++authVersion;
  invalidateSessionToasts();
  await serializeAuth(async () => {
    if (version !== authVersion) throw changed();
    await AsyncStorage.multiSet([
      [KEYS.context, context], [KEYS.access, data.accessToken],
      [KEYS.refresh, data.refreshToken], [KEYS.user, JSON.stringify(data.user)],
    ]);
  });
  // Register this device for order alerts (dynamic import avoids an api↔push cycle).
  if (version === authVersion && context === 'merchant') void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
}

export async function getEntryRoute(): Promise<'Login' | 'Tabs' | 'Onboard'> {
  const version = authVersion;
  return serializeAuth(async () => {
    if (version !== authVersion) return 'Login';
    const [access, context, rawUser] = await Promise.all([
      AsyncStorage.getItem(KEYS.access), AsyncStorage.getItem(KEYS.context), AsyncStorage.getItem(KEYS.user),
    ]);
    if (version !== authVersion || !access) return 'Login';
    return authDestination(rawUser ? JSON.parse(rawUser) : null, context === 'customer' ? 'customer' : 'merchant');
  });
}

export async function clearAuth() {
  const version = ++authVersion;
  invalidateSessionToasts();
  const captured = await serializeAuth(async () => {
    if (version !== authVersion) return null;
    const [access, refresh] = await Promise.all([AsyncStorage.getItem(KEYS.access), AsyncStorage.getItem(KEYS.refresh)]);
    if (version !== authVersion) return null;
    await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh, KEYS.user, KEYS.context]);
    return { access, refresh };
  });
  if (!captured) return;
  await import('./push').then((m) => m.unregisterPush(captured.access, version - 1)).catch(() => undefined);
  if (captured.refresh) await fetch(`${API_URL}/auth/logout`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(captured.access ? { authorization: `Bearer ${captured.access}` } : {}) },
    body: JSON.stringify({ refreshToken: captured.refresh }),
  }).catch(() => undefined);
}

const refreshing = new Map<number, Promise<boolean>>();
function renewSession(captured: { version: number; access: string; refresh: string; user: any }): Promise<boolean> {
  const existing = refreshing.get(captured.version);
  if (existing) return existing;
  const renewal = (async () => {
    if (captured.version !== authVersion) throw changed();
    const current = await AsyncStorage.getItem(KEYS.access);
    if (captured.version !== authVersion) throw changed();
    if (current !== captured.access) return true;
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: captured.refresh }),
      });
    } catch { throw new Error('Session renewal is unavailable. Try again.'); }
    if (captured.version !== authVersion) throw changed();
    if (!response.ok) {
      if (response.status === 401) return false;
      throw new Error('Session renewal is unavailable. Try again.');
    }
    const next = await response.json();
    if (captured.version !== authVersion || next.user?.id !== captured.user?.id) throw changed();
    await persistAuth(next, captured.version);
    return true;
  })().finally(() => { refreshing.delete(captured.version); });
  refreshing.set(captured.version, renewal);
  return renewal;
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const version = authVersion;
  const { access, refresh, user } = await serializeAuth(async () => {
    if (version !== authVersion) throw changed();
    const [access, refresh, rawUser] = await Promise.all([AsyncStorage.getItem(KEYS.access), AsyncStorage.getItem(KEYS.refresh), AsyncStorage.getItem(KEYS.user)]);
    if (version !== authVersion) throw changed();
    return { access, refresh, user: rawUser ? JSON.parse(rawUser) : null };
  });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (access) headers.authorization = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (version !== authVersion) throw changed();

  if (res.status === 401 && access && retry) {
    if (refresh && await renewSession({ version, access, refresh, user })) {
      if (version !== authVersion) throw changed();
      return request(method, path, body, false);
    }
    if (version !== authVersion) throw changed();
    await clearAuth();
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (version !== authVersion) throw changed();
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
  const version = authVersion;
  const access = await serializeAuth(async () => version === authVersion ? AsyncStorage.getItem(KEYS.access) : null);
  if (version !== authVersion) throw changed();
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
  if (version !== authVersion) throw changed();
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (version !== authVersion) throw changed();
  if (!res.ok) throw new Error(friendlyError(data?.message, res.status, '/uploads/image'));
  return data.url as string;
}

/** After /merchant/onboard returns fresh tokens, persist them + the user profile. */
export async function finishOnboarding(tokens: { accessToken: string; refreshToken: string; user?: any }) {
  const version = ++authVersion;
  invalidateSessionToasts();
  await serializeAuth(async () => {
    if (version !== authVersion) throw changed();
    await AsyncStorage.multiSet([
    [KEYS.access, tokens.accessToken],
    [KEYS.refresh, tokens.refreshToken],
    [KEYS.context, 'merchant'],
    ]);
  });
  const user = tokens.user ?? await request('GET', '/auth/me');
  if (version !== authVersion) throw changed();
  await serializeAuth(async () => {
    if (version !== authVersion) throw changed();
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  });
  if (version === authVersion) void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
  return user;
}

export function pkr(paisa: number | null | undefined): string {
  const amount = paisa ?? 0;
  return `Rs ${(amount / 100).toLocaleString('en-PK', { minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function statusLabel(status: string): string {
  return (status ?? '').replace(/_/g, ' ').toLowerCase();
}
