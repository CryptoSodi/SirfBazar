'use client';

const KEY = 'sb.checkoutRecovery.v1';

export type CheckoutPayload = {
  requestId: string;
  cartId: string;
  approvedQuote: string;
  deliveryAddressId: string;
  paymentMethod: 'COD';
  couponCode?: string;
  customerNote?: string;
};

export type CheckoutRecovery = {
  version: 1;
  owner: string;
  payload: CheckoutPayload;
  state: 'pending';
};

export function validCheckoutPayload(payload: Partial<CheckoutPayload> | null | undefined): payload is CheckoutPayload {
  return !!payload && typeof payload.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.requestId) &&
    typeof payload.cartId === 'string' && !!payload.cartId.trim() && typeof payload.deliveryAddressId === 'string' && !!payload.deliveryAddressId.trim() &&
    typeof payload.approvedQuote === 'string' && !!payload.approvedQuote.trim() && payload.paymentMethod === 'COD';
}

/** A missing or unreadable record is unsafe once submission may have started. */
export function readCheckoutRecovery(owner: string): CheckoutRecovery | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as CheckoutRecovery;
  if (value.version !== 1 || !value.owner || !validCheckoutPayload(value.payload)) {
    throw new Error('Saved checkout is damaged. Check order history or contact support before trying again.');
  }
  return value.owner === owner ? value : null;
}

export function saveCheckoutRecovery(record: CheckoutRecovery) {
  const previous = localStorage.getItem(KEY);
  if (previous && previous !== JSON.stringify(record)) {
    throw new Error('Another checkout still needs a status check on this device. Check its order history before placing a new order.');
  }
  if (!validCheckoutPayload(record.payload)) throw new Error('Your basket could not be verified. Open your basket and review it before returning to checkout.');
  const serialized = JSON.stringify(record);
  localStorage.setItem(KEY, serialized);
  if (localStorage.getItem(KEY) !== serialized) throw new Error('Checkout could not be saved on this device. Free storage or enable it before placing the order.');
}

export function clearCheckoutRecovery(record: CheckoutRecovery) {
  const raw = localStorage.getItem(KEY);
  if (raw && JSON.stringify(JSON.parse(raw)) === JSON.stringify(record)) localStorage.removeItem(KEY);
}

export function isDefinitiveRejection(status: unknown, code?: string) {
  return typeof status === 'number' && status >= 400 && status < 500 &&
    status !== 401 && status !== 408 && status !== 409 && code !== 'QUOTE_CHANGED';
}

/** A POST response that guarantees no order was written can release its saved identity. */
export function isDefinitiveNoWrite(status: unknown, code?: string) {
  return isDefinitiveRejection(status, code) || (status === 409 && code === 'QUOTE_CHANGED');
}
