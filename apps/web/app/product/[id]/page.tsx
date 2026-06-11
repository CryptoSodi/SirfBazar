'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { addToCart, api } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductImage } from '@/components/ProductCard';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { location, resolved } = useLocation();
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!resolved) return;
    api
      .get(`/products/${id}?${locationQuery(location)}`)
      .then(setProduct)
      .catch((e) => setError(e.message));
  }, [id, resolved, location?.latitude]);

  if (error) return <div className="card p-10 text-center text-stone-500">{error}</div>;
  if (!product) return <p className="text-stone-500">Loading…</p>;

  const offers: any[] = product.offers ?? [];

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
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <ProductImage name={product.name} imageUrl={product.imageUrl} className="h-72 w-full rounded-2xl" />
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="mt-1 text-sm text-stone-500">
            {[product.brand, product.size ?? product.unit].filter(Boolean).join(' · ')}
          </div>
          {product.description && <p className="mt-3 text-sm text-stone-600">{product.description}</p>}

          <h2 className="mb-2 mt-6 font-bold">Available from {offers.length} shop{offers.length === 1 ? '' : 's'} nearby</h2>
          <div className="space-y-2">
            {offers.map((o) => (
              <div key={o.merchantProductId} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <Link href={`/shop/${o.merchant.id}`} className="truncate font-semibold hover:text-emerald-700">
                    {o.merchant.shopName}
                  </Link>
                  <div className="text-xs text-stone-500">
                    ⭐ {o.merchant.ratingAverage?.toFixed?.(1) ?? '–'}
                    {o.merchant.distanceKm != null && ` · ${o.merchant.distanceKm} km`}
                    {o.merchant.estimatedDeliveryMinutes && ` · ~${o.merchant.estimatedDeliveryMinutes} min`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatPKR(o.discountPricePaisa ?? o.pricePaisa)}</div>
                  {o.discountPricePaisa && (
                    <div className="text-xs text-stone-400 line-through">{formatPKR(o.pricePaisa)}</div>
                  )}
                </div>
                <button
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={addingId === o.merchantProductId || !o.isAvailable || o.stockQuantity === 0}
                  onClick={() => add(o.merchantProductId)}
                >
                  {o.stockQuantity === 0 ? 'Out of stock' : addingId === o.merchantProductId ? '…' : '+ Add'}
                </button>
              </div>
            ))}
            {offers.length === 0 && (
              <div className="card p-6 text-center text-sm text-stone-500">
                No shop near you currently stocks this item.
              </div>
            )}
          </div>
        </div>
      </div>

      {(product.similar ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Similar products</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {product.similar.map((p: any) => (
              <ProductCard key={p.merchantProductId ?? p.productId} card={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
