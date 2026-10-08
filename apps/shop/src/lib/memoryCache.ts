type Entry<T> = { value: T; savedAt: number };

const memory = new Map<string, Entry<unknown>>();

export function memoryScope(): string {
  try {
    const session = JSON.parse(localStorage.getItem('sbs.session') || 'null');
    if (session) return `${session.epoch}:${session.identity}`;
    const user = JSON.parse(localStorage.getItem('sbs.user') || 'null');
    return String(user?.merchant?.id || user?.id || 'anonymous');
  } catch {
    return 'anonymous';
  }
}

function scoped(key: string, scope = memoryScope()) {
  return `${scope}:${key}`;
}

/** Session-only, last-success cache. It is intentionally never written to disk. */
export function readMemory<T>(key: string, scope = memoryScope()): T | undefined {
  return memory.get(scoped(key, scope))?.value as T | undefined;
}

export function writeMemory<T>(key: string, value: T, scope = memoryScope()): T {
  if (scope !== memoryScope()) return value;
  memory.set(scoped(key, scope), { value, savedAt: Date.now() });
  return value;
}

export function clearMemory() {
  memory.clear();
}

export function invalidateMemory(...prefixes: string[]) {
  const scope = `${memoryScope()}:`;
  for (const key of memory.keys()) {
    if (key.startsWith(scope) && prefixes.some((prefix) => key.slice(scope.length).startsWith(prefix))) memory.delete(key);
  }
}

// Socket events and local mutations share the same invalidation path. Hidden
// pages will therefore not reopen with data from before a realtime update.
if (typeof window !== 'undefined') {
  window.addEventListener('sb:session', clearMemory);
  window.addEventListener('sb:orders', () => invalidateMemory('orders:', 'dashboard', 'earnings', 'products:'));
  window.addEventListener('sb:products', () => invalidateMemory('products:', 'catalog:', 'dashboard'));
  window.addEventListener('sb:riders', () => invalidateMemory('riders', 'dashboard'));
  window.addEventListener('sb:merchant', () => invalidateMemory('merchant:profile', 'dashboard'));
}
