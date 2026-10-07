export type CustomerEvent = 'auth' | 'orders' | 'notifications' | 'support' | 'location';
const listeners = new Map<CustomerEvent, Set<() => void>>();
export function publishCustomerEvent(event: CustomerEvent) {
  listeners.get(event)?.forEach((listener) => listener());
}
export function subscribeCustomerEvent(event: CustomerEvent, listener: () => void) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
  return () => {
    listeners.get(event)?.delete(listener);
  };
}
