'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';
import { formatPKR, CATEGORY_EMOJI } from '@/lib/format';

export default function HomePage() {
  const { location, resolved } = useLocation();
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resolved || !location) return;
    const lq = locationQuery(location);
    setLoading(true);
    Promise.allSettled([
      api.get('/products/categories'),
      api.get(`/merchants/nearby?${lq}`),
      api.get(`/products/nearby?${lq}&pageSize=24`),
      api.get('/coupons'),
    ]).then(([c, s, p, co]) => {
      if (c.status === 'fulfilled') setCategories(c.value ?? []);
      if (s.status === 'fulfilled') setShops(s.value.items ?? s.value ?? []);
      if (p.status === 'fulfilled') setProducts(p.value.items ?? []);
      if (co.status === 'fulfilled') setCoupons(co.value ?? []);
      setLoading(false);
    });
  }, [resolved, location?.latitude, location?.longitude]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="card overflow-hidden bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Order from trusted local shops near you
        </h1>
        <p className="mt-1 text-emerald-50">
          Groceries, pharmacy, bakery, fruits & more — delivered fast by your neighbourhood stores.
        </p>
        {coupons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {coupons.slice(0, 3).map((c) => (
              <span key={c.id} className="chip bg-white/20 text-white">
                🎟️ {c.code} — {c.title}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Shop by category</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.id}?name=${encodeURIComponent(c.name)}`}
              className="card flex flex-col items-center gap-1.5 p-3 text-center hover:border-emerald-300"
            >
              <span className="text-2xl">{c.iconUrl || CATEGORY_EMOJI[c.slug] || '🛍️'}</span>
              <span className="text-[11px] font-medium leading-tight text-stone-600">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Nearby shops */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Shops near you</h2>
        {shops.length === 0 && !loading && (
          <p className="text-sm text-stone-500">No shops nearby yet — try changing your location.</p>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {shops.map((s) => (
            <Link key={s.id} href={`/shop/${s.id}`} className="card w-56 shrink-0 p-4 hover:border-emerald-300">
              <div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-xl">
                {s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  '🏪'
                )}
              </div>
              <div className="truncate font-semibold">{s.shopName}</div>
              <div className="mt-0.5 text-xs text-stone-500">
                ⭐ {s.ratingAverage?.toFixed?.(1) ?? '–'} · {s.distanceKm != null ? `${s.distanceKm} km` : s.city}
              </div>
              <div className="mt-1 text-xs text-stone-400">
                {s.estimatedDeliveryMinutes ? `~${s.estimatedDeliveryMinutes} min` : ''}
                {s.minimumOrderValuePaisa ? ` · min ${formatPKR(s.minimumOrderValuePaisa)}` : ''}
              </div>
              <span
                className={`chip mt-2 ${s.isOnline && s.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}
              >
                {s.isOnline && s.isOpen ? '● Open now' : 'Closed'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular products */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Popular near you</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-56 animate-pulse bg-stone-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {products.map((p) => (
              <ProductCard key={p.merchantProductId} card={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
