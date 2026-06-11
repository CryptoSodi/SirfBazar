'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, cartBase, fetchCart, updateCartItem } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { ProductImage } from '@/components/ProductCard';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () =>
    fetchCart()
      .then((c) => {
        setCart(c);
        window.dispatchEvent(new CustomEvent('sb:cart', { detail: c }));
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const setQty = async (itemId: string, quantity: number) => {
    setBusy(true);
    try {
      const view = await updateCartItem(itemId, quantity);
      setCart(view);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setBusy(true);
    setError('');
    try {
      const view = await api.post(`${cartBase()}/apply-coupon`, { code: coupon.trim() });
      setCart(view);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cart) return <p className="text-stone-500">Loading cart…</p>;

  if ((cart.groups ?? []).length === 0) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <div className="text-4xl">🛒</div>
        <h1 className="mt-2 text-lg font-bold">Your cart is empty</h1>
        <p className="mt-1 text-sm text-stone-500">Browse nearby shops and add something tasty.</p>
        <Link href="/" className="btn-primary mt-4 inline-block">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <h1 className="text-xl font-bold">Your cart</h1>
        {cart.groups.map((g: any) => (
          <section key={g.merchant.id} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <Link href={`/shop/${g.merchant.id}`} className="font-semibold hover:text-emerald-700">
                🏪 {g.merchant.shopName}
              </Link>
              <span className="text-xs text-stone-500">
                Delivery {formatPKR(g.deliveryFeePaisa)}
                {g.distanceKm != null && ` · ${g.distanceKm} km`}
              </span>
            </div>
            <div className="space-y-3">
              {g.items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  <ProductImage name={item.name} imageUrl={item.imageUrl} className="h-12 w-12 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-stone-500">
                      {formatPKR(item.unitPricePaisa)} {item.unit ? `/ ${item.unit}` : ''}
                      {!item.inStock && <span className="ml-2 font-semibold text-red-600">low stock!</span>}
                      {item.priceChanged && <span className="ml-2 text-amber-600">price updated</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="h-7 w-7 rounded-lg border border-stone-300 text-sm font-bold" disabled={busy} onClick={() => setQty(item.id, item.quantity - 1)}>
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button className="h-7 w-7 rounded-lg border border-stone-300 text-sm font-bold" disabled={busy} onClick={() => setQty(item.id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm font-bold">{formatPKR(item.totalPaisa)}</div>
                </div>
              ))}
            </div>
            {g.subtotalPaisa < (g.merchant.minimumOrderValuePaisa ?? 0) && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                This shop needs a minimum order of {formatPKR(g.merchant.minimumOrderValuePaisa)} — add{' '}
                {formatPKR(g.merchant.minimumOrderValuePaisa - g.subtotalPaisa)} more.
              </p>
            )}
          </section>
        ))}
      </div>

      {/* Summary */}
      <aside className="card h-fit p-5">
        <h2 className="mb-3 font-bold">Bill details</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
          <button className="btn-secondary whitespace-nowrap" onClick={applyCoupon} disabled={busy}>
            Apply
          </button>
        </div>
        {cart.couponCode && (
          <p className="mt-2 text-xs text-emerald-700">
            🎟️ {cart.couponCode} applied
            {cart.couponError && <span className="text-red-600"> — {cart.couponError}</span>}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <dl className="mt-4 space-y-1.5 text-sm">
          <Row label="Subtotal" value={cart.subtotalPaisa} />
          <Row label="Delivery fee" value={cart.deliveryFeePaisa} />
          <Row label="Service fee" value={cart.serviceFeePaisa} />
          {cart.smallOrderFeePaisa > 0 && <Row label="Small order fee" value={cart.smallOrderFeePaisa} />}
          {cart.discountPaisa > 0 && <Row label="Discount" value={-cart.discountPaisa} accent />}
          <div className="my-2 border-t border-dashed border-stone-200" />
          <div className="flex justify-between text-base font-bold">
            <dt>To pay</dt>
            <dd>{formatPKR(cart.totalPaisa)}</dd>
          </div>
        </dl>
        <button className="btn-primary mt-4 w-full" onClick={() => router.push('/checkout')}>
          Proceed to checkout →
        </button>
        <p className="mt-2 text-center text-[11px] text-stone-400">Login is only needed at the final step.</p>
      </aside>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={accent ? 'font-medium text-emerald-700' : ''}>{formatPKR(value)}</dd>
    </div>
  );
}
