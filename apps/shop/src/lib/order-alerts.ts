export type PendingOrder = { id: string; orderNumber: string };
export type OrderEvent = { orderId: string; orderNumber: string; status?: string };

export function readOrderEvent(value: unknown): OrderEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  if (typeof event.orderId !== 'string' || !event.orderId || typeof event.orderNumber !== 'string' || !event.orderNumber ||
      (event.status !== undefined && typeof event.status !== 'string')) return null;
  return event as OrderEvent;
}

// NEW_ORDER and order:update may describe the same order. Keying by ID avoids
// duplicate alerts; an accepted/cancelled order immediately leaves the queue.
export function applyOrderEvent(pending: PendingOrder[], event: OrderEvent): PendingOrder[] {
  if (event.status && event.status !== 'SENT_TO_MERCHANT') return pending.filter(order => order.id !== event.orderId);
  if (pending.some(order => order.id === event.orderId)) return pending;
  return [...pending, { id: event.orderId, orderNumber: event.orderNumber }];
}

export function realtimeOrigin(apiUrl: string): string {
  const url = new URL(apiUrl);
  if (!['http:', 'https:'].includes(url.protocol) || !['', '/', '/api', '/api/'].includes(url.pathname) || url.search || url.hash) {
    throw new Error('Invalid API address for live order alerts.');
  }
  // Socket.IO lives on the server origin, not the REST /api namespace.
  return url.origin;
}

export function claimSoundLease(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, tabId: string, now: number): boolean {
  try {
    const lease = JSON.parse(storage.getItem(key) || 'null');
    if (lease && lease.tabId !== tabId && lease.until > now) return false;
    storage.setItem(key, JSON.stringify({ tabId, until: now + 12_000 }));
  } catch { /* Storage unavailable: keep this tab's sound usable. */ }
  return true;
}
