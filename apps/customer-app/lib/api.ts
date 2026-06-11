import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * On a real device, localhost points at the phone — set your machine's LAN IP:
 *   EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api npx expo start
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const KEYS = {
  guest: 'sb.guestToken',
  access: 'sb.accessToken',
  refresh: 'sb.refreshToken',
  user: 'sb.user',
  location: 'sb.location',
};

export interface SbLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export const FALLBACK_LOCATION: SbLocation = {
  latitude: 31.5204,
  longitude: 74.3587,
  label: 'Lahore (Gulberg)',
};

export async function getLocation(): Promise<SbLocation> {
  const raw = await AsyncStorage.getItem(KEYS.location);
  return raw ? JSON.parse(raw) : FALLBACK_LOCATION;
}

export async function setLocation(loc: SbLocation) {
  await AsyncStorage.setItem(KEYS.location, JSON.stringify(loc));
}

export async function getUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export async function isLoggedIn(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(KEYS.access));
}

export async function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  await AsyncStorage.multiSet([
    [KEYS.access, data.accessToken],
    [KEYS.refresh, data.refreshToken],
    [KEYS.user, JSON.stringify(data.user)],
  ]);
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh, KEYS.user]);
}

async function ensureGuestToken(): Promise<string> {
  let token = await AsyncStorage.getItem(KEYS.guest);
  if (token) return token;
  const loc = await getLocation();
  const res = await fetch(`${API_URL}/guest/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude, city: 'Lahore' }),
  });
  const data = await res.json();
  await AsyncStorage.setItem(KEYS.guest, data.sessionToken);
  return data.sessionToken;
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const access = await AsyncStorage.getItem(KEYS.access);
  if (access) headers.authorization = `Bearer ${access}`;
  if (path.startsWith('/guest')) headers['x-guest-session'] = await ensureGuestToken();

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
          await storeAuth(await r.json());
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

export async function cartBase(): Promise<string> {
  return (await isLoggedIn()) ? '/cart' : '/guest/cart';
}

export async function fetchCart() {
  const loc = await getLocation();
  return api.get(`${await cartBase()}?latitude=${loc.latitude}&longitude=${loc.longitude}`);
}

export async function afterLogin(auth: { accessToken: string; refreshToken: string; user: any }) {
  await storeAuth(auth);
  if (await AsyncStorage.getItem(KEYS.guest)) {
    try {
      await request('POST', '/guest/cart/merge-after-login');
    } catch {
      /* empty guest cart is fine */
    }
  }
}

export function pkr(paisa: number | null | undefined): string {
  return `Rs ${Math.round((paisa ?? 0) / 100).toLocaleString()}`;
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
