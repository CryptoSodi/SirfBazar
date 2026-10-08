import { friendlyError } from './friendly-error';
import { browserSession } from './browserSession';
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const LS = { access: 'sbp.accessToken', refresh: 'sbp.refreshToken', user: 'sbp.user' };
const session = browserSession('sbp');
export const captureSession = session.read;
export const sessionIsCurrent = session.sameOwner;

export const MERCHANT_ROLES = ['MERCHANT_OWNER', 'MERCHANT_STAFF'];
export function isMerchant(user: any): boolean {
  return !!user && MERCHANT_ROLES.includes(user.role);
}

export function getUser(): any | null {
  return session.read().user;
}

export function isLoggedIn() {
  return !!session.read().access;
}

export function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  session.write(data);
}

export function logout() {
  session.clear();
  location.href = '/login';
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const captured = session.read();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = captured.access;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!session.sameGeneration(captured)) throw new Error('Your session changed. Refresh this page.');
  if (res.status === 401 && retry && captured.refresh) {
    const refreshed = await session.renew(captured, `${API_URL}/auth/refresh-token`);
    if (refreshed) {
      if (!session.sameOwner(captured)) throw new Error('Your session changed. Refresh this page.');
      return request(method, path, body, false);
    }
    if (!session.read().access) location.href = '/login';
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!session.sameGeneration(captured)) throw new Error('Your session changed. Refresh this page.');
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

/** Rupees from paisa, whole-rupee display. */
export function pkr(paisa: number | null | undefined): string {
  const amount = paisa ?? 0;
  return `Rs ${(amount / 100).toLocaleString('en-PK', { minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Date + time for a sale row. */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
