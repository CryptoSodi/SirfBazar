'use client';
import { friendlyError } from './friendly-error';

/**
 * SirfBazar API client. Handles three header concerns transparently:
 *  - x-guest-session for anonymous browsing/cart (created lazily)
 *  - Authorization bearer once logged in (with one silent refresh on 401)
 *  - guest→customer cart merge after login at checkout
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const LS = {
  guest: 'sb.guestToken',
  access: 'sb.accessToken',
  refresh: 'sb.refreshToken',
  user: 'sb.user',
  location: 'sb.location',
};

let refreshPromise: Promise<boolean> | null = null;

export interface SbLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export function getStoredLocation(): SbLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(LS.location) || 'null');
  } catch {
    return null;
  }
}

export function storeLocation(loc: SbLocation) {
  localStorage.setItem(LS.location, JSON.stringify(loc));
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(LS.user) || 'null');
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return typeof window !== 'undefined' && !!localStorage.getItem(LS.access);
}

/** Reading the site header must not create a guest session. */
export function hasCartSession() {
  return typeof window !== 'undefined' && (isLoggedIn() || !!localStorage.getItem(LS.guest));
}

/** Use only after the person accepts losing an unrecoverable expired guest basket. */
export function startNewGuestBasket() {
  if (isLoggedIn()) return;
  localStorage.removeItem(LS.guest);
  window.dispatchEvent(new Event('sb:cart'));
}

async function ensureGuestToken(): Promise<string> {
  let token = localStorage.getItem(LS.guest);
  if (token) return token;
  const loc = getStoredLocation();
  const res = await fetch(`${API_URL}/guest/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      city: 'Lahore',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.sessionToken) {
    throw new ApiError(res.status, data?.message || 'Unable to start your basket. Try again.');
  }
  token = data.sessionToken as string;
  localStorage.setItem(LS.guest, token);
  return token;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
  constructor(status: number, message: string, code?: string, details?: any) {
    super(friendlyError(message, status, '', code));
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function rawRequest(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const access = localStorage.getItem(LS.access);
  if (access) headers.authorization = `Bearer ${access}`;
  if (path.startsWith('/guest')) headers['x-guest-session'] = await ensureGuestToken();

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && access && retry) {
    const refreshed = await refreshOnce();
    if (refreshed) return rawRequest(method, path, body, false);
    logoutLocal();
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    const msg = friendlyError(data?.message, res.status, path, data?.code);
    throw new ApiError(res.status, msg, data?.code, data);
  }
  return data;
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(LS.refresh);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    storeAuth(data);
    return true;
  } catch {
    return false;
  }
}

export function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  localStorage.setItem(LS.access, data.accessToken);
  localStorage.setItem(LS.refresh, data.refreshToken);
  localStorage.setItem(LS.user, JSON.stringify(data.user));
}

export function logoutLocal() {
  localStorage.removeItem(LS.access);
  localStorage.removeItem(LS.refresh);
  localStorage.removeItem(LS.user);
  window.dispatchEvent(new Event('sb:auth'));
}

export const api = {
  get: (path: string) => rawRequest('GET', path),
  post: (path: string, body?: unknown) => rawRequest('POST', path, body),
  put: (path: string, body?: unknown) => rawRequest('PUT', path, body),
  del: (path: string) => rawRequest('DELETE', path),
};

/** Cart routes differ for guests vs customers; this picks the right one. */
export function cartBase() {
  return isLoggedIn() ? '/cart' : '/guest/cart';
}

export async function fetchCart() {
  const loc = getStoredLocation();
  const qs = loc ? `?latitude=${loc.latitude}&longitude=${loc.longitude}` : '';
  return api.get(`${cartBase()}${qs}`);
}

export async function addToCart(merchantProductId: string, quantity = 1) {
  const view = await api.post(`${cartBase()}/items`, { merchantProductId, quantity });
  window.dispatchEvent(new CustomEvent('sb:cart', { detail: view }));
  return view;
}

export async function updateCartItem(itemId: string, quantity: number) {
  const view = await api.put(`${cartBase()}/items/${itemId}`, { quantity });
  window.dispatchEvent(new CustomEvent('sb:cart', { detail: view }));
  return view;
}

/** A merge can have partly completed. Never retry it automatically. */
export class CartMergeUncertainError extends Error {
  constructor() {
    super('Your account is ready, but we could not confirm your guest basket was saved. Check your basket before continuing.');
    this.name = 'CartMergeUncertainError';
  }
}

/** After OTP/Google login: merge once, then require an explicit basket review. */
export async function afterLogin(auth: { accessToken: string; refreshToken: string; user: any }) {
  storeAuth(auth);
  window.dispatchEvent(new Event('sb:auth'));
  const guest = localStorage.getItem(LS.guest);
  if (guest) {
    try {
      await rawRequest('POST', '/guest/cart/merge-after-login');
      localStorage.removeItem(LS.guest);
    } catch {
      window.dispatchEvent(new Event('sb:cart'));
      throw new CartMergeUncertainError();
    }
  }
  window.dispatchEvent(new Event('sb:cart'));
}
