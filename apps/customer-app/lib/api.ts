import { friendlyError } from './friendly-error';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCredential, writeCredential, removeCredential } from './credentials';
import { publishCustomerEvent } from './customer-events';
import { invalidateSessionToasts } from './toast-session';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { resolveApiUrl } from './customer-flow';

/**
 * Defaults to the live production API (reachable from any device).
 * For local backend work, override with your machine's LAN IP:
 *   EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api npx expo start
 */
export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Platform.OS,
  Constants.expoConfig?.hostUri,
);

const KEYS = {
  guest: 'sb.guestToken',
  access: 'sb.accessToken',
  refresh: 'sb.refreshToken',
  user: 'sb.user',
  location: 'sb.location',
  mergePending: 'sb.mergePending',
};

export interface SbLocation {
  latitude: number;
  longitude: number;
  label: string;
  confirmed?: boolean;
}

export const FALLBACK_LOCATION: SbLocation = {
  latitude: 31.5204,
  longitude: 74.3587,
  label: 'Lahore demo area (choose your location)',
  confirmed: false,
};

export async function getLocation(): Promise<SbLocation> {
  return (await getConfirmedLocation()) ?? FALLBACK_LOCATION;
}

/** Unknown browsing location is not the map's initial camera centre. */
export async function getConfirmedLocation(): Promise<SbLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.location);
    if (!raw) return null;
    const loc = JSON.parse(raw);
    if (loc.confirmed === false || /demo area/i.test(loc.label ?? '') ||
      !Number.isFinite(loc.latitude) || Math.abs(loc.latitude) > 90 ||
      !Number.isFinite(loc.longitude) || Math.abs(loc.longitude) > 180) return null;
    return { ...loc, confirmed: true };
  } catch { return null; }
}

export async function setLocation(loc: SbLocation) {
  await AsyncStorage.setItem(KEYS.location, JSON.stringify({ ...loc, confirmed: loc.confirmed !== false }));
  publishCustomerEvent('location');
}

export async function clearLocation() {
  await AsyncStorage.removeItem(KEYS.location);
  publishCustomerEvent('location');
}

export async function getUser(): Promise<any | null> {
  const version = authVersion;
  return serializeAuth(async () => {
    if (version !== authVersion) return null;
    const raw = await AsyncStorage.getItem(KEYS.user);
    return version === authVersion && raw ? JSON.parse(raw) : null;
  });
}

export async function isLoggedIn(): Promise<boolean> {
  return !!(await getAccessToken());
}
export const getAccessToken = () => {
  const version = authVersion;
  return serializeAuth(async () => {
    if (version !== authVersion) return null;
    const token = await readCredential(KEYS.access);
    return version === authVersion ? token : null;
  });
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any,
  ) {
    super(message);
  }
}
export async function timedFetch(url: string, init: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}

/** Persist tokens only — used by the silent refresh path (no push side-effects). */
let authWrites: Promise<unknown> = Promise.resolve();
function serializeAuth<T>(task: () => Promise<T>): Promise<T> {
  const operation = authWrites.then(task);
  authWrites = operation.catch(() => undefined);
  return operation;
}
async function persistAuth(
  data: { accessToken: string; refreshToken: string; user: any },
  version = authVersion,
) {
  return serializeAuth(async () => {
    if (version !== authVersion) throw new ApiError('Your session changed. Sign in again.', 401);
    await writeCredential(KEYS.refresh, data.refreshToken);
    await writeCredential(KEYS.access, data.accessToken);
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(data.user));
    if (version !== authVersion) throw new ApiError('Your session changed. Sign in again.', 401);
  });
}

export async function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  const version = ++authVersion;
  invalidateSessionToasts();
  await persistAuth(data, version);
  if (version !== authVersion) throw new ApiError('Your session changed. Sign in again.', 401);
  publishCustomerEvent('auth');
  // Register this device for order alerts (dynamic import avoids an api↔push cycle).
  if (version === authVersion) void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
}

export async function clearAuth() {
  const version = ++authVersion;
  invalidateSessionToasts();
  const captured = await serializeAuth(async () => {
    if (version !== authVersion) return null;
    const [access, refresh] = await Promise.all([readCredential(KEYS.access), readCredential(KEYS.refresh)]);
    if (version !== authVersion) return null;
    await Promise.all([removeCredential(KEYS.access), removeCredential(KEYS.refresh)]);
    await AsyncStorage.multiRemove([KEYS.user, KEYS.mergePending]);
    return { access, refresh };
  });
  publishCustomerEvent('auth');
  if (!captured) return;
  await import('./push').then((m) => m.unregisterPush(captured.access, version - 1)).catch(() => undefined);
  if (captured.refresh) await timedFetch(`${API_URL}/auth/logout`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(captured.access ? { authorization: `Bearer ${captured.access}` } : {}) },
    body: JSON.stringify({ refreshToken: captured.refresh }),
  }).catch(() => undefined);
}

let authVersion = 0;
export const getAuthVersion = () => authVersion;
let refreshing: { version: number; promise: Promise<void> } | null = null;
export async function renewSession() {
  const version = authVersion;
  if (!refreshing || refreshing.version !== version) {
    const promise = (async () => {
      const { refreshToken, user } = await serializeAuth(async () => {
        if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
        const [token, rawUser] = await Promise.all([
          readCredential(KEYS.refresh),
          AsyncStorage.getItem(KEYS.user),
        ]);
        if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
        return { refreshToken: token, user: rawUser ? JSON.parse(rawUser) : null };
      });
      if (!refreshToken) throw new ApiError('Sign in again to renew your session.', 401);
      const res = await timedFetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
      if (!res.ok) throw new ApiError('Sign in again to renew your session.', res.status);
      const auth = await res.json();
      if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
      if (user?.id && auth.user?.id !== user.id) throw new ApiError('Sign in again to renew your session.', 401);
      await persistAuth(auth, version);
      if (version === authVersion) publishCustomerEvent('auth');
    })();
    const entry = { version, promise };
    refreshing = entry;
    const clearRefresh = () => {
      if (refreshing === entry) refreshing = null;
    };
    void promise.then(clearRefresh, clearRefresh);
  }
  return refreshing.promise;
}

let creatingGuest: Promise<string> | null = null;

async function ensureGuestToken(): Promise<string> {
  let token = await AsyncStorage.getItem(KEYS.guest);
  if (token) return token;
  if (creatingGuest) return creatingGuest;
  creatingGuest = (async () => {
    const loc = await getConfirmedLocation();
    const res = await timedFetch(`${API_URL}/guest/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(loc ? { latitude: loc.latitude, longitude: loc.longitude } : {}),
    });
    const data = await res.json();
    if (!res.ok || !data.sessionToken)
      throw new ApiError('Unable to start your basket. Try again.', res.status);
    await AsyncStorage.setItem(KEYS.guest, data.sessionToken);
    return data.sessionToken;
  })().finally(() => {
    creatingGuest = null;
  });
  return creatingGuest;
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const version = authVersion;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const publicRead = method === 'GET' && /^\/(products|merchants|location|coupons)(\/|\?|$)/.test(path);
  const access = publicRead ? null : await getAccessToken();
  if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
  if (access) headers.authorization = `Bearer ${access}`;
  if (path.startsWith('/guest')) headers['x-guest-session'] = await ensureGuestToken();
  if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);

  const res = await timedFetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);

  if (res.status === 401 && access && retry) {
    try {
      // Another request may already have rotated this token.
      if ((await getAccessToken()) === access) await renewSession();
      if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
      return request(method, path, body, false);
    } catch (cause) {
      if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) await clearAuth();
      throw cause;
    }
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
  if (!res.ok) {
    const msg = friendlyError(data?.message, res.status, path, data?.code);
    throw new ApiError(msg, res.status, data?.code, data);
  }
  return data;
}

export const api = {
  get: (p: string) => request('GET', p),
  post: (p: string, b?: unknown) => request('POST', p, b),
  put: (p: string, b?: unknown) => request('PUT', p, b),
  del: (p: string) => request('DELETE', p),
};

export async function cartBase(): Promise<string> {
  return (await isLoggedIn()) ? '/cart' : '/guest/cart';
}

export async function fetchCart(location?: { latitude: number; longitude: number }) {
  const loc = location ?? (await getConfirmedLocation());
  return api.get(`${await cartBase()}${loc ? `?latitude=${loc.latitude}&longitude=${loc.longitude}` : ''}`);
}

export async function afterLogin(auth: { accessToken: string; refreshToken: string; user: any }) {
  const before = authVersion;
  const guest = await AsyncStorage.getItem(KEYS.guest);
  if (before !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
  if (guest) await AsyncStorage.setItem(KEYS.mergePending, auth.user.id);
  await storeAuth(auth);
  const version = authVersion;
  if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
  await retryBasketMerge();
  if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
}

export async function hasPendingBasketMerge() {
  const user = await getUser();
  return !!user && (await AsyncStorage.getItem(KEYS.mergePending)) === user.id;
}
let merging: Promise<void> | null = null;
export async function retryBasketMerge() {
  if (merging) return merging;
  merging = (async () => {
    const version = authVersion;
    const user = await getUser();
    const guest = await AsyncStorage.getItem(KEYS.guest);
    if (version !== authVersion) throw new ApiError('Your session changed. Try again.', 409);
    if (!(await hasPendingBasketMerge())) return;
    await request('POST', '/guest/cart/merge-after-login');
    if (version !== authVersion || (await getUser())?.id !== user?.id || (await AsyncStorage.getItem(KEYS.guest)) !== guest)
      throw new ApiError('Your session changed. Check your basket.', 409);
    await AsyncStorage.multiRemove([KEYS.mergePending, KEYS.guest]);
  })().finally(() => {
    merging = null;
  });
  return merging;
}

export function pkr(paisa: number | null | undefined): string {
  if (paisa == null || !Number.isFinite(paisa)) return 'Not available';
  return `Rs ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: paisa % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SENT_TO_MERCHANT: 'Waiting for shop',
    MERCHANT_ACCEPTED: 'Shop accepted',
    PREPARING: 'Being prepared',
    READY_FOR_PICKUP: 'Ready for pickup',
    RIDER_ASSIGNED: 'Rider assigned',
    RIDER_ARRIVED_AT_SHOP: 'Rider at shop',
    ON_THE_WAY: 'On the way',
    RIDER_ARRIVED_AT_CUSTOMER: 'Rider at your door',
    DELIVERED: 'Delivered',
    PAYMENT_PENDING: 'Awaiting payment',
  };
  return map[status] ?? status.replace(/_/g, ' ').toLowerCase();
}
