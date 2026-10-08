// Pure auth-generation signal; no React import or credential access.
const listeners = new Set<() => void>();
let generation = 0;
export function toastSessionGeneration() { return generation; }
export function invalidateSessionToasts() {
  generation++;
  listeners.forEach((listener) => listener());
}
export function onSessionInvalidated(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
