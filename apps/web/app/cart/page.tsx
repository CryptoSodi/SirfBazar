'use client';
import { AppIcon as UiIcon } from '../../components/AppIcon';


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, cartBase, fetchCart, startNewGuestBasket, updateCartItem } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { ProductImage } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewedUpdates, setReviewedUpdates] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const view = await fetchCart();
      setCart(view);
      window.dispatchEvent(new CustomEvent('sb:cart', { detail: view }));
    } catch (e: any) { setError(e.message || 'Unable to load your basket. Try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const setQty = async (itemId: string, quantity: number) => {
    setBusy(true); setError(''); setReviewedUpdates(false);
    try {
      if (quantity === 0) await api.del(`${cartBase()}/items/${itemId}`);
      else await updateCartItem(itemId, quantity);
      await refresh();
    } catch (e: any) { setError(e.message || 'Unable to update this item. Try again.'); }
    finally { setBusy(false); }
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setBusy(true); setError('');
    try { await api.post(`${cartBase()}/apply-coupon`, { code: coupon.trim() }); await refresh(); }
    catch (e: any) { setError(e.message || 'Unable to apply coupon. Try again.'); }
    finally { setBusy(false); }
  };

  if (loading && !cart) return <p role="status">Loading your basket…</p>;
  if (!cart) return <div role="alert" className="card p-5"><p>{error || 'Unable to load your basket.'}</p>{/guest session expired/i.test(error) ? <><p className="sb-muted mt-2">The previous guest basket may no longer be recoverable. Starting a new one will not restore those items.</p><button className="btn-secondary mt-3" onClick={() => { if (confirm('Start a new empty basket? Your expired guest basket may not be recoverable.')) { startNewGuestBasket(); void refresh(); } }}>Start a new basket</button></> : <button className="btn-secondary mt-3" onClick={() => void refresh()}>Try again</button>}</div>;
  if (!(cart.groups ?? []).length) return <div className="sb-cart-empty"><h1>Your basket is empty</h1><p>Choose an everyday essential from a local shop to get started.</p><Link href="/search" className="btn-primary">Browse essentials&nbsp; <UiIcon name="arrow" size={18} /></Link></div>;

  const itemChanged = cart.groups.some((group: any) => group.items.some((item: any) => item.priceChanged || !item.inStock));
  const blocked = itemChanged && !reviewedUpdates;

  return <div className="sb-cart"><nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><span>Your basket</span></nav><div className="sb-cart-heading"><div><h1>Your basket</h1><p>{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · {cart.groups.length} {cart.groups.length === 1 ? 'shop' : 'shops'} · Sign in only at checkout.</p></div><Link href="/search">Keep shopping&nbsp; <UiIcon name="arrow" size={18} /></Link></div>
    <div className="sb-cart-grid"><div className="sb-cart-groups">{cart.groups.map((group: any) => <section key={group.merchant.id} className="card sb-cart-group"><div className="sb-cart-group-head"><Icon name="shop" size={22} /><span><Link href={`/shop/${group.merchant.id}`}>{group.merchant.shopName}</Link><small>Prepared and delivered by this shop</small></span><b>{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</b></div>
      {group.items.map((item: any) => <div key={item.id} className="sb-cart-item"><ProductImage name={item.name} imageUrl={item.imageUrl} className="sb-cart-image" /><div className="sb-cart-item-details"><strong>{item.name}</strong><small>{item.size || item.unit || 'See item details'}</small>{item.priceChanged && <span className="sb-price-warning">Price updated · review needed</span>}{!item.inStock && <span className="sb-price-warning">Availability changed · review needed</span>}<div className="sb-quantity"><button disabled={busy} aria-label={`Remove one ${item.name}`} onClick={() => void setQty(item.id, item.quantity - 1)}>−</button><span aria-label={`${item.quantity} in basket`}>{item.quantity}</span><button disabled={busy} aria-label={`Add one ${item.name}`} onClick={() => void setQty(item.id, item.quantity + 1)}>+</button></div></div><div className="sb-cart-item-end"><strong>{formatPKR(item.totalPaisa)}</strong><button disabled={busy} onClick={() => void setQty(item.id, 0)}>Remove</button></div></div>)}
      {group.subtotalPaisa < (group.merchant.minimumOrderValuePaisa ?? 0) && <p className="sb-error">Add {formatPKR(group.merchant.minimumOrderValuePaisa - group.subtotalPaisa)} more from this shop to meet its minimum order.</p>}
      <div className="sb-cart-group-foot"><span>Estimated delivery: {group.etaMinutes ?? group.merchant.estimatedDeliveryMinutes ?? 'Check at checkout'}{group.etaMinutes || group.merchant.estimatedDeliveryMinutes ? ' min' : ''}</span><span>Delivery {formatPKR(group.deliveryFeePaisa)}</span></div>
    </section>)}<p className="sb-cart-info">Prices and stock are checked again before placement. Adding another shop keeps your existing basket.</p></div>
    <aside className="card sb-cart-summary"><h2>Your order summary</h2><dl><div><dt>Items subtotal ({cart.itemCount})</dt><dd>{formatPKR(cart.subtotalPaisa)}</dd></div>{cart.groups.map((group: any) => <div key={group.merchant.id}><dt>{group.merchant.shopName} delivery</dt><dd>{formatPKR(group.deliveryFeePaisa)}</dd></div>)}<div><dt>Service fee</dt><dd>{formatPKR(cart.serviceFeePaisa)}</dd></div>{cart.smallOrderFeePaisa > 0 && <div><dt>Small order fee</dt><dd>{formatPKR(cart.smallOrderFeePaisa)}</dd></div>}{cart.discountPaisa > 0 && <div><dt>Discount</dt><dd>−{formatPKR(cart.discountPaisa)}</dd></div>}<div className="sb-total"><dt>Estimated total</dt><dd>{formatPKR(cart.totalPaisa)}</dd></div></dl><p className="sb-muted mt-3">Delivery will be checked against your final address.</p>
      {blocked && <div className="sb-cart-warning" role="alert">One or more items changed. Review their price and availability before continuing.</div>}
      {error && <p className="sb-error" role="alert">{error}</p>}
      <button className="btn-primary mt-4 w-full" onClick={() => blocked ? setReviewedUpdates(true) : router.push('/checkout')} disabled={busy}>{blocked ? 'I’ve reviewed the update' : <>Continue to checkout <UiIcon name="arrow" size={18} /></>}</button><p className="sb-muted mt-3 text-center">Sign in or create an account only at checkout.</p>
      <details className="sb-coupon"><summary>Have a coupon?</summary><div><label className="sr-only" htmlFor="coupon-code">Coupon code</label><input id="coupon-code" className="input" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" /><button className="btn-secondary" onClick={() => void applyCoupon()} disabled={busy}>Apply</button></div>{cart.couponError && <p role="alert" className="sb-error">{cart.couponError}</p>}</details>
      <p className="sb-cart-info">{cart.groups.length === 1 ? 'One shop, one delivery. You’ll see each shop’s progress.' : `Items from ${cart.groups.length} shops arrive in separate deliveries. You’ll see each shop’s progress.`}</p>
    </aside></div>
  </div>;
}
