import { useEffect, useState } from 'react';
import { api, fetchCart, isLoggedIn } from './api';

/**
 * Tiny global store for the bottom-tab badges: number of items in the cart and
 * number of active (in-progress) orders. Screens/components call refreshBadges()
 * after any cart/order change; the tab bar subscribes via useBadges().
 */
const TERMINAL_ORDER_STATUSES = [
  'DELIVERED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_MERCHANT',
  'CANCELLED_BY_ADMIN',
  'MERCHANT_REJECTED',
  'FAILED_DELIVERY',
];

export interface Badges {
  cart: number;
  orders: number;
}

let current: Badges = { cart: 0, orders: 0 };
const listeners = new Set<(b: Badges) => void>();

function publish(next: Badges) {
  current = next;
  for (const l of listeners) l(current);
}

/** Re-fetch cart item count and active-order count. Safe to call anytime. */
export async function refreshBadges() {
  const next: Badges = { ...current };

  try {
    const cart = await fetchCart();
    next.cart = cart?.itemCount ?? 0;
  } catch {
    /* leave previous cart count on transient failure */
  }

  try {
    if (await isLoggedIn()) {
      const orders = await api.get('/orders');
      next.orders = Array.isArray(orders)
        ? orders.filter((o: any) => !TERMINAL_ORDER_STATUSES.includes(o.status)).length
        : 0;
    } else {
      next.orders = 0; // guests have no orders
    }
  } catch {
    /* leave previous orders count */
  }

  publish(next);
}

/** Immediately zero the badges (e.g. on logout) without a round-trip. */
export function resetBadges() {
  publish({ cart: 0, orders: 0 });
}

export function useBadges(): Badges {
  const [b, setB] = useState<Badges>(current);
  useEffect(() => {
    const l = (next: Badges) => setB(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return b;
}
