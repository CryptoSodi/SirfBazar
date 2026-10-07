import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCredential, writeCredential, removeCredential } from './credentials';
import { publishCustomerEvent } from './customer-events';
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
  const raw = await AsyncStorage.getItem(KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export async function isLoggedIn(): Promise<boolean> {
  return !!(await getAccessToken());
}
export const getAccessToken = () => readCredential(KEYS.access);
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
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
  });
}

export async function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  authVersion++;
  await persistAuth(data);
  publishCustomerEvent('auth');
  // Register this device for order alerts (dynamic import avoids an api↔push cycle).
  void import('./push').then((m) => m.registerForPush()).catch(() => undefined);
}

export async function clearAuth() {
  const version = ++authVersion;
  // Stop alerts to this device while the token is still valid.
  await import('./push').then((m) => m.unregisterPush()).catch(() => undefined);
  await serializeAuth(async () => {
    if (version !== authVersion) return;
    await Promise.all([removeCredential(KEYS.access), removeCredential(KEYS.refresh)]);
    await AsyncStorage.removeItem(KEYS.user);
  });
  publishCustomerEvent('auth');
}

let authVersion = 0;
let refreshing: Promise<void> | null = null;
export async function renewSession() {
  if (!refreshing) {
    const version = authVersion;
    refreshing = (async () => {
      const refreshToken = await readCredential(KEYS.refresh);
      if (!refreshToken) throw new ApiError('Sign in again to renew your session.', 401);
      const res = await timedFetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new ApiError('Sign in again to renew your session.', res.status);
      const auth = await res.json();
      if (version !== authVersion) throw new ApiError('Your session changed. Sign in again.', 401);
      await persistAuth(auth, version);
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
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
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const publicRead = method === 'GET' && /^\/(products|merchants|location|coupons)(\/|\?|$)/.test(path);
  const access = publicRead ? null : await getAccessToken();
  if (access) headers.authorization = `Bearer ${access}`;
  if (path.startsWith('/guest')) headers['x-guest-session'] = await ensureGuestToken();

  const res = await timedFetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && access && retry) {
    try {
      // Another request may already have rotated this token.
      if ((await getAccessToken()) === access) await renewSession();
      return request(method, path, body, false);
    } catch (cause) {
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
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || `Request failed (${res.status})`;
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

export async function cartBase(): Promise<string> {
  return (await isLoggedIn()) ? '/cart' : '/guest/cart';
}

export async function fetchCart(location?: { latitude: number; longitude: number }) {
  const loc = location ?? (await getConfirmedLocation());
  return api.get(`${await cartBase()}${loc ? `?latitude=${loc.latitude}&longitude=${loc.longitude}` : ''}`);
}

export async function afterLogin(auth: { accessToken: string; refreshToken: string; user: any }) {
  authVersion++;
  if (await AsyncStorage.getItem(KEYS.guest)) await AsyncStorage.setItem(KEYS.mergePending, auth.user.id);
  await storeAuth(auth);
  await retryBasketMerge();
}

export async function hasPendingBasketMerge() {
  const user = await getUser();
  return !!user && (await AsyncStorage.getItem(KEYS.mergePending)) === user.id;
}
let merging: Promise<void> | null = null;
export async function retryBasketMerge() {
  if (merging) return merging;
  merging = (async () => {
    if (!(await hasPendingBasketMerge())) return;
    await request('POST', '/guest/cart/merge-after-login');
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
