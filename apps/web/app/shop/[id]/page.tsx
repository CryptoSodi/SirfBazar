'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { addToCart, api } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductImage } from '@/components/ProductCard';

export default function ShopPage() {
  const { id } = useParams<{ id: string }>();
  const { location, resolved } = useLocation();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!resolved) return;
    api.get(`/merchants/${id}?${locationQuery(location)}`).then(setShop).catch((e) => setError(e.message));
    api.get(`/merchants/${id}/reviews?pageSize=10`).then((r) => setReviews(r.items ?? [])).catch(() => undefined);
  }, [id, resolved, location?.latitude]);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get(`/merchants/${id}/products?pageSize=60${q ? `&q=${encodeURIComponent(q)}` : ''}`)
        .then((r) => setProducts(r.items ?? []))
        .catch(() => setProducts([]));
    }, 250);
    return () => clearTimeout(t);
  }, [id, q]);

  if (error) return <div className="card p-10 text-center text-stone-500">{error}</div>;
  if (!shop) return <p className="text-stone-500">Loading…</p>;

  const add = async (merchantProductId: string) => {
    setAddingId(merchantProductId);
    try {
      await addToCart(merchantProductId, 1);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Shop header */}
      <section className="card overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-emerald-600 to-emerald-400" />
        <div className="-mt-8 px-5 pb-5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-emerald-50 text-2xl shadow">
            🏪
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{shop.shopName}</h1>
            <span className={`chip ${shop.isOnline && shop.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
              {shop.isOnline && shop.isOpen ? '● Open now' : 'Closed'}
            </span>
          </div>
          <div className="mt-1 text-sm text-stone-500">
            ⭐ {shop.ratingAverage?.toFixed?.(1) ?? '–'} ({shop.ratingCount ?? 0} ratings)
            {shop.distanceKm != null && ` · ${shop.distanceKm} km away`}
            {shop.estimatedDeliveryMinutes && ` · ~${shop.estimatedDeliveryMinutes} min delivery`}
          </div>
          <div className="mt-1 text-xs text-stone-400">
            {shop.address} · {shop.openingTime}–{shop.closingTime}
            {shop.minimumOrderValuePaisa ? ` · Minimum order ${formatPKR(shop.minimumOrderValuePaisa)}` : ''}
          </div>
          {shop.description && <p className="mt-2 text-sm text-stone-600">{shop.description}</p>}
        </div>
      </section>

      {/* Products */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Products</h2>
          <input className="input max-w-xs" placeholder="Search in this shop…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((mp) => {
            const price = mp.discountPricePaisa ?? mp.pricePaisa;
            return (
              <div key={mp.merchantProductId ?? mp.id} className="card flex items-center gap-3 p-3">
                <ProductImage name={mp.product.name} imageUrl={mp.product.imageUrl} className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{mp.product.name}</div>
                  <div className="text-xs text-stone-500">
                    {[mp.product.brand, mp.product.size ?? mp.product.unit].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-0.5 text-sm font-bold">
                    {formatPKR(price)}
                    {mp.discountPricePaisa && (
                      <span className="ml-1.5 text-xs font-normal text-stone-400 line-through">{formatPKR(mp.pricePaisa)}</span>
                    )}
                  </div>
                </div>
                <button
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={addingId === (mp.merchantProductId ?? mp.id) || !mp.isAvailable || mp.stockQuantity === 0}
                  onClick={() => add(mp.merchantProductId ?? mp.id)}
                >
                  {mp.stockQuantity === 0 ? 'Out' : addingId === (mp.merchantProductId ?? mp.id) ? '…' : '+ Add'}
                </button>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="card col-span-full p-8 text-center text-sm text-stone-500">No products match.</div>
          )}
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Customer reviews</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="text-sm font-semibold">
                  {'⭐'.repeat(r.rating)} <span className="text-stone-400">· {r.customer?.fullName ?? 'Customer'}</span>
                </div>
                {r.reviewText && <p className="mt-1 text-sm text-stone-600">{r.reviewText}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
