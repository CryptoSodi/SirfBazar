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

/** A missing or unreadable record is unsafe once submission may have started. */
export function readCheckoutRecovery(owner: string): CheckoutRecovery | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as CheckoutRecovery;
  if (value.version !== 1 || !value.owner || !value.payload?.requestId || !value.payload?.cartId || !value.payload?.approvedQuote) {
    throw new Error('Saved checkout is damaged. Check order history or contact support before trying again.');
  }
  return value.owner === owner ? value : null;
}

export function saveCheckoutRecovery(record: CheckoutRecovery) {
  const previous = localStorage.getItem(KEY);
  if (previous && previous !== JSON.stringify(record)) {
    throw new Error('Another checkout still needs a status check on this device. Check its order history before placing a new order.');
  }
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
