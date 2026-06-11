export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const LS = { access: 'sba.accessToken', refresh: 'sba.refreshToken', user: 'sba.user' };

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

export function tone(status: string): string {
  const s = status?.toUpperCase?.() ?? '';
  if (['APPROVED', 'DELIVERED', 'PAID', 'COMPLETED', 'ACTIVE', 'RESOLVED'].includes(s))
    return 'bg-emerald-100 text-emerald-700';
  if (['REJECTED', 'SUSPENDED', 'FAILED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_MERCHANT', 'CANCELLED_BY_ADMIN', 'MERCHANT_REJECTED', 'FAILED_DELIVERY', 'DELETED', 'ON_HOLD'].includes(s))
    return 'bg-red-100 text-red-700';
  if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'SENT_TO_MERCHANT', 'PAYMENT_PENDING', 'REQUESTED', 'OPEN', 'PROCESSING', 'CASH_PENDING'].includes(s))
    return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}
