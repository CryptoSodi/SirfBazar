import { useSyncExternalStore } from 'react';
import { addToCart, captureSession, fetchCart, updateCartItem } from './api';

type Cart = { groups?: Array<{ items?: Array<any> }> };
type CartState = {
  cart: Cart | null;
  loaded: boolean;
  loading: boolean;
  loadError: string;
  busy: Set<string>;
  optimistic: Map<string, number>;
  itemErrors: Map<string, string>;
};

const state: CartState = {
  cart: null, loaded: false, loading: false, loadError: '',
  busy: new Set(), optimistic: new Map(), itemErrors: new Map(),
};
const listeners = new Set<() => void>();
const serverSnapshot: CartState = {
  cart: null, loaded: false, loading: false, loadError: '',
  busy: new Set(), optimistic: new Map(), itemErrors: new Map(),
};
let refreshPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
let eventsInstalled = false;
let ownerIdentity = '';

function notify() { listeners.forEach(listener => listener()); }

function findItem(cart: Cart | null, merchantProductId: string) {
  return cart?.groups?.flatMap(group => group.items ?? [])
    .find(item => item.merchantProductId === merchantProductId) ?? null;
}

function receiveCart(cart: Cart) {
  state.cart = cart;
  state.loaded = true;
  state.loading = false;
  state.loadError = '';
  state.optimistic = new Map([...state.optimistic].filter(([id]) => state.busy.has(id)));
  notify();
}

export function refreshCartState() {
  if (refreshPromise) return refreshPromise;
  state.loading = true;
  state.loadError = '';
  notify();
  refreshPromise = fetchCart().then(receiveCart).catch((error: any) => {
    state.loading = false;
    state.loadError = error?.message || 'Could not load your basket.';
    notify();
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function installEvents() {
  if (eventsInstalled || typeof window === 'undefined') return;
  eventsInstalled = true;
  ownerIdentity = captureSession().identity;
  window.addEventListener('sb:cart', event => {
    const cart = (event as CustomEvent<Cart>).detail;
    if (cart?.groups) receiveCart(cart);
    else void refreshCartState();
  });
  window.addEventListener('sb:auth', refreshForCurrentOwner);
  window.addEventListener('sb:session', refreshForCurrentOwner);
  window.addEventListener('sb:location', () => void refreshCartState());
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  installEvents();
  if (!state.loaded && !state.loading) void refreshCartState();
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => serverSnapshot;

function refreshForCurrentOwner() {
  const nextOwner = captureSession().identity;
  if (nextOwner !== ownerIdentity) {
    ownerIdentity = nextOwner;
    state.cart = null;
    state.loaded = false;
    state.loading = false;
    state.loadError = '';
    state.busy = new Set();
    state.optimistic = new Map();
    state.itemErrors = new Map();
    notify();
  }
  void refreshCartState();
}

export function useCartQuantity(merchantProductId: string, maxStock?: number, available = true) {
  const current = useSyncExternalStore(subscribeCart, getSnapshot, getServerSnapshot);
  const item = findItem(current.cart, merchantProductId);
  const quantity = current.optimistic.has(merchantProductId)
    ? current.optimistic.get(merchantProductId)!
    : item?.quantity ?? 0;
  const stock = Number.isFinite(maxStock) ? Math.max(0, maxStock!) : Number.POSITIVE_INFINITY;
  const effectiveStock = item?.stockQuantity == null ? stock : Math.min(stock, Math.max(0, item.stockQuantity));
  const busy = current.busy.has(merchantProductId);
  const loading = !current.loaded && current.loading;
  const error = current.itemErrors.get(merchantProductId) || (!current.loaded ? current.loadError : '');

  const change = (nextQuantity: number) => {
    if (!current.loaded || busy || !Number.isInteger(nextQuantity)) return;
    const target = Math.max(0, Math.min(nextQuantity, effectiveStock));
    if (target === quantity || (target > quantity && !available)) return;
    state.busy = new Set(state.busy).add(merchantProductId);
    state.optimistic = new Map(state.optimistic).set(merchantProductId, target);
    state.itemErrors = new Map(state.itemErrors);
    state.itemErrors.delete(merchantProductId);
    notify();

    const operation = mutationQueue.then(async () => {
      const currentItem = findItem(state.cart, merchantProductId);
      if (target === 0 && !currentItem) return;
      const cart = currentItem
        ? await updateCartItem(currentItem.id, target)
        : await addToCart(merchantProductId, target);
      state.cart = cart;
      state.loaded = true;
      state.loadError = '';
    });
    mutationQueue = operation.then(() => undefined, () => undefined);
    void operation.catch(async (cause: any) => {
      state.itemErrors = new Map(state.itemErrors).set(merchantProductId, cause?.message || 'Could not update the basket.');
      await refreshCartState();
    }).finally(() => {
      state.busy = new Set(state.busy);
      state.busy.delete(merchantProductId);
      state.optimistic = new Map(state.optimistic);
      state.optimistic.delete(merchantProductId);
      notify();
    });
  };

  return {
    quantity,
    loading,
    busy,
    error,
    canIncrement: available && quantity < effectiveStock,
    change,
    retry: refreshCartState,
  };
}
