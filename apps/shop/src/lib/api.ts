import { clearMemory, invalidateMemory } from './memoryCache';
import { friendlyError } from './friendly-error';
import { browserSession } from './browserSession';

const configuredApiUrl = (import.meta.env?.VITE_API_URL || '').trim();

export function resolveApiUrl(base: string, path: string): string {
  if (!base) throw new ApiError('config', 'VITE_API_URL is not configured. Set it to the SirfBazar API base.');
  let url: URL;
  try { url = new URL(base); }
  catch { throw new ApiError('config', 'VITE_API_URL must be an absolute HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new ApiError('config', 'VITE_API_URL must be an HTTP(S) origin or /api base without a query or fragment.');
  }
  const basePath = url.pathname.replace(/\/+$/, '');
  if (basePath && basePath !== '/api') {
    throw new ApiError('config', 'VITE_API_URL must end in /api exactly once.');
  }
  if (!path.startsWith('/') || path === '/api' || path.startsWith('/api/')) {
    throw new ApiError('config', 'API request paths must begin after the configured /api base.');
  }
  return `${url.origin}/api${path}`;
}

export const API_URL = configuredApiUrl;

export type ApiErrorKind = 'config' | 'network' | 'timeout' | 'unauthorized' | 'permission' | 'http' | 'contract';
export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public status?: number) {
    super(kind === 'http' || kind === 'unauthorized' ? message : friendlyError(message, status));
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  return friendlyError(error);
}

const LS = { access: 'sbs.accessToken', refresh: 'sbs.refreshToken', user: 'sbs.user' };
const session = browserSession('sbs');
export const captureSession = session.read;
export const sessionIsCurrent = session.sameOwner;
export const sessionGenerationIsCurrent = session.sameGeneration;

export const MERCHANT_ROLES = ['MERCHANT_OWNER', 'MERCHANT_STAFF'];
function merchantToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return MERCHANT_ROLES.includes(decoded.role);
  } catch { return false; }
}
export function isMerchant(user: any): boolean {
  // getMe returns the user's base role, which can still be CUSTOMER when the
  // merchant-context token has the owner/staff role.
  return !!user?.merchant?.id || (Array.isArray(user?.staffOf) && user.staffOf.some((s: any) => s.status === 'ACTIVE'));
}

export function getUser(): any | null {
  return session.read().user;
}

export function isLoggedIn() {
  return merchantToken(session.read().access) && isMerchant(getUser());
}

export function getAccessToken(): string | null {
  return session.read().access;
}

export function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  if (!data?.accessToken || !data?.refreshToken || !merchantToken(data.accessToken) || !isMerchant(data.user)) {
    throw new ApiError('contract', 'The server did not return a merchant session.');
  }
  const previous = getUser();
  if (previous?.id !== data.user?.id || previous?.merchant?.id !== data.user?.merchant?.id) clearMemory();
  session.write(data);
}

export function clearSession() {
  clearMemory();
  session.clear();
}

export async function logout() {
  const captured = session.read();
  clearSession();
  try {
    if (captured.refresh) await fetchWithTimeout(apiEndpoint('/auth/logout'), {
      method: 'POST', headers: { 'content-type': 'application/json', ...(captured.access ? { authorization: `Bearer ${captured.access}` } : {}) },
      body: JSON.stringify({ refreshToken: captured.refresh }),
    });
  } catch {
    // Server revocation may be unreachable; still remove the local session.
  } finally {
    if (!session.read().access) location.assign('/sign-in');
  }
}

function apiEndpoint(path: string): string { return resolveApiUrl(API_URL, path); }

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('timeout', 'The service did not respond in time. Refresh the record before retrying a change.');
    throw new ApiError('network', 'Unable to reach the merchant service. Check your connection and API access.');
  } finally {
    window.clearTimeout(timer);
  }
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const captured = session.read();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = captured.access;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(apiEndpoint(path), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!session.sameGeneration(captured)) throw new ApiError('unauthorized', 'Your session changed. Refresh this page.', 401);
  if (res.status === 401 && retry && captured.refresh) {
    let refresh: 'ok' | 'invalid' | 'unavailable';
    try { refresh = (await session.renew(captured, apiEndpoint('/auth/refresh-token'))) ? 'ok' : 'invalid'; }
    catch { refresh = 'unavailable'; }
    // A mutation may have reached the server before its response was lost;
    // never automatically replay it after refreshing credentials.
    if (refresh === 'ok' && method === 'GET') {
      if (!session.sameOwner(captured)) throw new ApiError('unauthorized', 'Your session changed. Refresh this page.', 401);
      return request(method, path, body, false);
    }
    if (refresh === 'unavailable') throw new ApiError('network', 'Session renewal is unavailable. Refresh this record before retrying.');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!session.sameGeneration(captured)) throw new ApiError('unauthorized', 'Your session changed. Refresh this page.', 401);
  if (!res.ok) {
    const msg = friendlyError(data?.message, res.status, path, data?.code);
    if (res.status === 401 && path === '/auth/verify-otp') throw new ApiError('http', msg, 401);
    if (res.status === 401) throw new ApiError('unauthorized', 'Your session needs to be renewed. Sign in and refresh this record before retrying.', 401);
    if (res.status === 403) throw new ApiError('permission', `Your merchant account does not have permission for this action. ${msg}`, 403);
    throw new ApiError('http', msg, res.status);
  }
  if (method !== 'GET') invalidateAfterMutation(path);
  return data;
}

function invalidateAfterMutation(path: string) {
  if (path === '/pos/sales') {
    invalidateMemory('products:', 'catalog:', 'dashboard');
    window.dispatchEvent(new Event('sb:products'));
  } else if (path.startsWith('/merchant/orders/')) {
    invalidateMemory('orders:', 'dashboard', 'earnings', 'products:');
    window.dispatchEvent(new Event('sb:orders'));
    window.dispatchEvent(new Event('sb:products'));
  } else if (path.startsWith('/merchant/products')) {
    invalidateMemory('products:', 'catalog:', 'dashboard');
    window.dispatchEvent(new Event('sb:products'));
  } else if (path.startsWith('/merchant/riders')) {
    invalidateMemory('riders', 'dashboard');
    window.dispatchEvent(new Event('sb:riders'));
  } else if (path.startsWith('/merchant/')) {
    invalidateMemory('dashboard', 'merchant:profile');
    window.dispatchEvent(new Event('sb:merchant'));
  }
}

async function authenticatedFileRequest(path: string, init: RequestInit): Promise<Response> {
  const captured = session.read();
  const token = captured.access;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetchWithTimeout(apiEndpoint(path), { ...init, headers });
  if (!session.sameGeneration(captured)) throw new ApiError('unauthorized', 'Your session changed. Refresh this page.', 401);
  if (!response.ok) {
    let data: any = null;
    try { data = await response.json(); } catch { /* non-JSON response */ }
    const message = friendlyError(data?.message, response.status, path, data?.code);
    if (response.status === 401) throw new ApiError('unauthorized', 'Your session needs to be renewed. Sign in again before retrying.', 401);
    if (response.status === 403) throw new ApiError('permission', `Your merchant account does not have permission for this action. ${message}`, 403);
    throw new ApiError('http', message, response.status);
  }
  return response;
}

async function upload(path: string, form: FormData) {
  const captured = session.read();
  const response = await authenticatedFileRequest(path, { method: 'POST', body: form });
  const result = await response.json();
  if (captured.access && !session.sameOwner(captured)) throw new ApiError('unauthorized', 'Your session changed. Refresh this page.', 401);
  return result;
}

async function download(path: string) {
  const captured = session.read();
  const response = await authenticatedFileRequest(path, { method: 'GET' });
  const result = await response.blob();
  if (captured.access && !session.sameOwner(captured)) throw new ApiError('unauthorized', 'Your session changed. Refresh this page.', 401);
  return result;
}

export const api = {
  get: (p: string) => request('GET', p),
  getParsed: async <T>(p: string, parse: (value: unknown) => T): Promise<T> => parse(await request('GET', p)),
  post: (p: string, b?: unknown) => request('POST', p, b),
  put: (p: string, b?: unknown) => request('PUT', p, b),
  del: (p: string) => request('DELETE', p),
  upload,
  download,
};

export function pkr(paisa: number | null | undefined): string {
  const amount = paisa ?? 0;
  return `Rs ${(amount / 100).toLocaleString('en-PK', { minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Human label for an order status (mirrors the customer app). */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SENT_TO_MERCHANT: 'New order',
    MERCHANT_ACCEPTED: 'Accepted',
    PREPARING: 'Preparing',
    READY_FOR_PICKUP: 'Ready for pickup',
    RIDER_ASSIGNED: 'Rider assigned',
    RIDER_ARRIVED_AT_SHOP: 'Rider at shop',
    PICKED_UP: 'Picked up',
    ON_THE_WAY: 'On the way',
    RIDER_ARRIVED_AT_CUSTOMER: 'Rider at customer',
    DELIVERED: 'Delivered',
    MERCHANT_REJECTED: 'Rejected',
    CANCELLED_BY_CUSTOMER: 'Cancelled (customer)',
    CANCELLED_BY_MERCHANT: 'Cancelled (shop)',
    CANCELLED_BY_ADMIN: 'Cancelled (admin)',
    FAILED_DELIVERY: 'Failed delivery',
  };
  return map[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function tone(status: string): string {
  const s = status?.toUpperCase?.() ?? '';
  if (['APPROVED', 'DELIVERED', 'PAID', 'COMPLETED', 'ACTIVE', 'RESOLVED', 'READY_FOR_PICKUP'].includes(s))
    return 'bg-emerald-100 text-emerald-700';
  if (['REJECTED', 'SUSPENDED', 'FAILED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_MERCHANT', 'CANCELLED_BY_ADMIN', 'MERCHANT_REJECTED', 'FAILED_DELIVERY', 'DELETED', 'ON_HOLD'].includes(s))
    return 'bg-red-100 text-red-700';
  if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'SENT_TO_MERCHANT', 'PAYMENT_PENDING', 'REQUESTED', 'OPEN', 'PROCESSING', 'CASH_PENDING', 'PREPARING'].includes(s))
    return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}
