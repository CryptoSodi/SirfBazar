import { api, fetchCart } from './api';

/** List cards do not carry policy flags. Only explicit detail flags permit an increase. */
export function productPurchaseProblem(product: any, productId: string): string | null {
  if (product?.isRestricted === true || product?.requiresPrescription === true) {
    return 'This product cannot be added here. Restricted and prescription products are not available for this checkout.';
  }
  if (!productId || product?.id !== productId || product.isRestricted !== false || product.requiresPrescription !== false) {
    return 'This product’s purchase eligibility could not be confirmed. Check its details before adding it.';
  }
  return null;
}

export async function assertProductCanBeAdded(productId: string) {
  if (!productId) throw new Error('This product’s purchase eligibility could not be confirmed.');
  let product: any;
  try { product = await api.get(`/products/${encodeURIComponent(productId)}`); }
  catch { throw new Error('Could not check this product’s purchase eligibility. No item was added. Check your connection and try again.'); }
  const problem = productPurchaseProblem(product, productId);
  if (problem) throw new Error(problem);
}

export type BasketItemSnapshot = { id: string; quantity: number };
export function basketItemSnapshot(cart: any, merchantProductId: string): BasketItemSnapshot | null {
  if (!cart || typeof cart.id !== 'string' || !cart.id || !Array.isArray(cart.groups) ||
    !Number.isSafeInteger(cart.itemCount) || cart.itemCount < 0 ||
    cart.groups.some((group: any) => !Array.isArray(group?.items))) {
    throw new Error('The current basket could not be confirmed.');
  }
  const items = cart.groups.flatMap((group: any) => group.items);
  if (items.some((item: any) => !item || typeof item.merchantProductId !== 'string' || !item.merchantProductId ||
    typeof item.id !== 'string' || !item.id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) ||
    items.reduce((total: number, item: any) => total + item.quantity, 0) !== cart.itemCount) {
    throw new Error('The complete basket contents could not be confirmed.');
  }
  const matches = items.filter((item: any) => item.merchantProductId === merchantProductId);
  if (matches.length > 1 || matches.some((item: any) => typeof item.id !== 'string' || !item.id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error('The current quantity could not be confirmed.');
  }
  return matches.length ? { id: matches[0].id, quantity: matches[0].quantity } : null;
}

export async function readConfirmedBasketItem(merchantProductId: string, cartId?: string) {
  const cart = await fetchCart();
  const item = basketItemSnapshot(cart, merchantProductId);
  if (cartId && cart.id !== cartId) throw new Error('Your basket changed. Check the original basket before retrying the addition.');
  return { cartId: cart.id as string, item };
}

// Durable per-cart marker: remounting a card cannot blindly repeat an uncertain additive POST.
export const pendingBasketAddKey = (cartId: string, merchantProductId: string) =>
  `sb.pendingBasketAdd.${cartId}.${merchantProductId}`;
