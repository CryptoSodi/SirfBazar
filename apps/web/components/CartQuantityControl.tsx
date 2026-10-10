'use client';

import { AppIcon } from './AppIcon';
import { useCartQuantity } from '@/lib/cart-store';

export function CartQuantityControl({
  merchantProductId, name, maxStock, available = true,
}: {
  merchantProductId: string;
  name: string;
  maxStock?: number;
  available?: boolean;
}) {
  const cart = useCartQuantity(merchantProductId, maxStock, available);
  const unavailable = !available || maxStock === 0;

  return <div className="sb-cart-quantity-control">
    {cart.loading ? <button type="button" className="sb-product-add" disabled aria-busy="true">Checking…</button> : cart.error && !cart.quantity ? <button type="button" className="sb-product-add" onClick={cart.retry}>Retry basket</button> : cart.quantity > 0 ? <div className="sb-inline-quantity" role="group" aria-label={`${name} quantity`}>
      <button type="button" aria-label={`Decrease ${name} quantity`} disabled={cart.busy} onClick={() => cart.change(cart.quantity - 1)}><AppIcon name="minus" size={17} /></button>
      <output aria-label={`${cart.quantity} in basket`}>{cart.quantity}</output>
      <button type="button" aria-label={`Increase ${name} quantity`} disabled={cart.busy || !cart.canIncrement} onClick={() => cart.change(cart.quantity + 1)}><AppIcon name="plus" size={17} /></button>
    </div> : <button type="button" className="sb-product-add" disabled={cart.busy || unavailable} onClick={() => cart.change(1)} aria-label={unavailable ? `${name} out of stock` : `Add ${name} to basket`}>
      {unavailable ? 'Out of stock' : <><AppIcon name="plus" size={16} /> Add</>}
    </button>}
    {cart.error && !!cart.quantity && <p className="sb-card-error" role="alert">{cart.error}</p>}
  </div>;
}
