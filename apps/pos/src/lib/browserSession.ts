/** One atomic browser snapshot. Legacy keys remain for existing UI readers. */
export type BrowserSession = {
  access: string | null;
  refresh: string | null;
  user: any | null;
  epoch: string;
  identity: string;
};

function identity(user: any, access: string | null): string {
  let role = user?.role ?? '';
  try {
    const payload = access?.split('.')[1];
    if (payload) role = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ?? role;
  } catch { /* Login also supports opaque test tokens. */ }
  const shop = user?.merchant?.id ?? user?.staffOf?.find?.((staff: any) => staff.status === 'ACTIVE')?.merchantId ?? '';
  return [user?.id ?? '', role, shop].join(':');
}

export function browserSession(prefix: string) {
  const key = `${prefix}.session`;
  const accessKey = `${prefix}.accessToken`;
  const refreshKey = `${prefix}.refreshToken`;
  const userKey = `${prefix}.user`;
  const lockKey = `${prefix}.refreshLock`;
  const inFlight = new Map<string, Promise<BrowserSession | null>>();
  const notify = () => window.dispatchEvent(new Event('sb:session'));
  function read(): BrowserSession {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as BrowserSession;
    } catch { /* Recover from legacy keys. */ }
    const access = localStorage.getItem(accessKey);
    const refresh = localStorage.getItem(refreshKey);
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { /* empty */ }
    return { access, refresh, user, epoch: `legacy:${refresh ?? ''}`, identity: identity(user, access) };
  }
  function write(data: { accessToken: string; refreshToken: string; user: any }, epoch: string = crypto.randomUUID()) {
    const next: BrowserSession = {
      access: data.accessToken, refresh: data.refreshToken, user: data.user,
      epoch, identity: identity(data.user, data.accessToken),
    };
    // Publish one authoritative record before maintaining compatibility keys.
    localStorage.setItem(key, JSON.stringify(next));
    localStorage.setItem(accessKey, data.accessToken);
    localStorage.setItem(refreshKey, data.refreshToken);
    localStorage.setItem(userKey, JSON.stringify(next.user));
    notify();
    return next;
  }
  function clear(expected?: BrowserSession) {
    const now = read();
    if (expected && (now.epoch !== expected.epoch || now.refresh !== expected.refresh || now.identity !== expected.identity)) return false;
    localStorage.setItem(key, JSON.stringify({ access: null, refresh: null, user: null, epoch: crypto.randomUUID(), identity: '' }));
    localStorage.removeItem(accessKey);
    localStorage.removeItem(refreshKey);
    localStorage.removeItem(userKey);
    notify();
    return true;
  }
  function sameOwner(captured: BrowserSession) {
    const now = read();
    return !!captured.access && now.epoch === captured.epoch && now.identity === captured.identity;
  }
  function sameGeneration(captured: BrowserSession) {
    const now = read();
    return now.epoch === captured.epoch && now.identity === captured.identity;
  }
  async function lease<T>(work: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(lockKey, work);
    // localStorage has no atomic compare-and-swap. Never risk two rotations.
    throw new Error('Secure session renewal is unavailable in this browser. Sign in again.');
  }
  function renew(captured: BrowserSession, endpoint: string): Promise<BrowserSession | null> {
    const flightKey = [captured.epoch, captured.identity, captured.refresh].join('|');
    let flight = inFlight.get(flightKey);
    if (!flight) {
      flight = lease(async () => {
        let now = read();
        if (now.epoch !== captured.epoch || now.identity !== captured.identity) return null;
        if (now.refresh !== captured.refresh || now.access !== captured.access) return now;
        if (!captured.refresh) return null;
        let response: Response;
        let data: any;
        let expired = false;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => { expired = true; controller.abort(); reject(new Error('Session renewal timed out. Try again.')); }, 15000);
          });
          ({ response, data } = await Promise.race([
            (async () => {
              const result = await fetch(endpoint, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ refreshToken: captured.refresh }), signal: controller.signal,
              });
              return { response: result, data: result.ok ? await result.json() : null };
            })(),
            timeout,
          ]));
        } catch { throw new Error('Session renewal is unavailable. Try again.'); }
        finally { if (timer) clearTimeout(timer); }
        if (expired) throw new Error('Session renewal is unavailable. Try again.');
        now = read();
        if (now.epoch !== captured.epoch || now.identity !== captured.identity) return null;
        if (now.refresh !== captured.refresh || now.access !== captured.access) return now;
        if (!response.ok) {
          if (response.status === 401) {
            // A competing tab may have won before its storage event arrived.
            await new Promise((resolve) => setTimeout(resolve, 50));
            now = read();
            if (now.epoch === captured.epoch && now.identity === captured.identity && now.refresh !== captured.refresh) return now;
            clear(captured);
            return null;
          }
          throw new Error('Session renewal is unavailable. Try again.');
        }
        now = read();
        if (now.epoch !== captured.epoch || now.identity !== captured.identity) return null;
        if (now.refresh !== captured.refresh || now.access !== captured.access) return now;
        if (!data?.accessToken || !data?.refreshToken || data.user?.id !== captured.user?.id ||
            identity(data.user, data.accessToken) !== captured.identity) return null;
        return write(data, captured.epoch);
      }).finally(() => { if (inFlight.get(flightKey) === flight) inFlight.delete(flightKey); });
      inFlight.set(flightKey, flight);
    }
    return flight;
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
    if (event.key === key) notify();
  });
  return { read, write, clear, sameOwner, sameGeneration, renew, key };
}
