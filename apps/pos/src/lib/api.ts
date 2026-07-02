export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const LS = { access: 'sbp.accessToken', refresh: 'sbp.refreshToken', user: 'sbp.user' };

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

/** Rupees from paisa, whole-rupee display. */
export function pkr(paisa: number | null | undefined): string {
  return `Rs ${Math.round((paisa ?? 0) / 100).toLocaleString()}`;
}

/** Date + time for a sale row. */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
