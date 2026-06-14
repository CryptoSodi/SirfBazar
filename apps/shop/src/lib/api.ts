export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const LS = { access: 'sbs.accessToken', refresh: 'sbs.refreshToken', user: 'sbs.user' };

export const MERCHANT_ROLES = ['MERCHANT_OWNER', 'MERCHANT_STAFF'];
export function isMerchant(user: any): boolean {
  return !!user && MERCHANT_ROLES.includes(user.role);
}

export function getUser(): any | null {
  try {
    return JSON.parse(localStorage.getItem(LS.user) || 'null');
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return !!localStorage.getItem(LS.access);
}

export function storeAuth(data: { accessToken: string; refreshToken: string; user: any }) {
  localStorage.setItem(LS.access, data.accessToken);
  localStorage.setItem(LS.refresh, data.refreshToken);
  localStorage.setItem(LS.user, JSON.stringify(data.user));
}

export function logout() {
  localStorage.removeItem(LS.access);
  localStorage.removeItem(LS.refresh);
  localStorage.removeItem(LS.user);
  location.href = '/login';
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = localStorage.getItem(LS.access);
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && localStorage.getItem(LS.refresh)) {
    const ok = await tryRefresh();
    if (ok) return request(method, path, body, false);
    logout();
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem(LS.refresh) }),
    });
    if (!res.ok) return false;
    storeAuth(await res.json());
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: (p: string) => request('GET', p),
  post: (p: string, b?: unknown) => request('POST', p, b),
  put: (p: string, b?: unknown) => request('PUT', p, b),
  del: (p: string) => request('DELETE', p),
};

export function pkr(paisa: number | null | undefined): string {
  return `Rs ${Math.round((paisa ?? 0) / 100).toLocaleString()}`;
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
