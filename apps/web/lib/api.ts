'use client';
import { friendlyError } from './friendly-error';
import { browserSession } from './browserSession';

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
const session = browserSession('sb');
export const captureSession = session.read;
export const sessionIsCurrent = session.sameOwner;
export const sessionGenerationIsCurrent = session.sameGeneration;
let creatingGuest: Promise<string> | null = null;
const guestEpoch = () => localStorage.getItem('sb.guestEpoch') || 'legacy';

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
  return session.read().user;
}

export function isLoggedIn() {
  return typeof window !== 'undefined' && !!session.read().access;
}

/** Reading the site header must not create a guest session. */
export function hasCartSession() {
  return typeof window !== 'undefined' && (isLoggedIn() || !!localStorage.getItem(LS.guest));
}

/** Use only after the person accepts losing an unrecoverable expired guest basket. */
export function startNewGuestBasket() {
  if (isLoggedIn()) return;
  localStorage.setItem('sb.guestEpoch', crypto.randomUUID());
  localStorage.removeItem(LS.guest);
  window.dispatchEvent(new Event('sb:cart'));
}

async function ensureGuestToken(): Promise<string> {
  let token = localStorage.getItem(LS.guest);
  if (token) return token;
  if (creatingGuest) return creatingGuest;
  const generation = guestEpoch();
  const auth = session.read();
  const create = async () => {
  token = localStorage.getItem(LS.guest);
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
  if (generation !== guestEpoch() || session.read().epoch !== auth.epoch || isLoggedIn())
    throw new ApiError(409, 'Your basket session changed. Try again.');
  const winner = localStorage.getItem(LS.guest);
  if (winner) return winner;
  localStorage.setItem(LS.guest, token);
  return token;
  };
  creatingGuest = (async () => {
    if (navigator.locks?.request) return navigator.locks.request('sb.guest-create', create);
    return create();
  })().finally(() => { creatingGuest = null; });
  return creatingGuest;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
  constructor(status: number, message: string, code?: string, details?: any, path = '') {
    super(friendlyError(message, status, path, code));
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function rawRequest(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const captured = session.read();
  const capturedGuestEpoch = guestEpoch();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const access = captured.access;
  if (access) headers.authorization = `Bearer ${access}`;
  if (path.startsWith('/guest')) headers['x-guest-session'] = await ensureGuestToken();
  if (!session.sameGeneration(captured) || (path.startsWith('/guest') && capturedGuestEpoch !== guestEpoch()))
    throw new ApiError(409, 'Your session changed. Try again.');

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!session.sameGeneration(captured) || (path.startsWith('/guest') && capturedGuestEpoch !== guestEpoch()))
    throw new ApiError(409, 'Your session changed. Try again.');
  if (res.status === 401 && access && retry) {
    const refreshed = await session.renew(captured, `${API_URL}/auth/refresh-token`);
    if (refreshed) {
      if (!session.sameOwner(captured)) throw new ApiError(409, 'Your session changed. Try again.');
      return rawRequest(method, path, body, false);
    }
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!session.sameGeneration(captured) || (path.startsWith('/guest') && capturedGuestEpoch !== guestEpoch()))
    throw new ApiError(409, 'Your session changed. Try again.');
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || '', data?.code, data, path);
  }
  return data;
}

export function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  session.write(data);
}

export function logoutLocal() {
  session.clear();
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
  const captured = session.read();
  window.dispatchEvent(new Event('sb:auth'));
  const guest = localStorage.getItem(LS.guest);
  if (guest) {
    try {
      await rawRequest('POST', '/guest/cart/merge-after-login');
      if (!session.sameOwner(captured)) throw new Error('Session changed');
      if (localStorage.getItem(LS.guest) === guest) localStorage.removeItem(LS.guest);
    } catch {
      if (session.sameOwner(captured)) window.dispatchEvent(new Event('sb:cart'));
      throw new CartMergeUncertainError();
    }
  }
  if (session.sameOwner(captured)) window.dispatchEvent(new Event('sb:cart'));
}
