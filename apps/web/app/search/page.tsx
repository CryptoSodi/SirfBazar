'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const { location, resolved } = useLocation();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [sort, setSort] = useState('relevance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resolved) return;
    setLoading(true);
    api
      .get(`/products/search?q=${encodeURIComponent(q)}&sort=${sort}&pageSize=48&${locationQuery(location)}`)
      .then((res) => setItems(res.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, sort, resolved, location?.latitude]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          {q ? <>Results for “{q}”</> : 'Search'}
          {!loading && <span className="ml-2 text-sm font-normal text-stone-400">{items.length} items</span>}
        </h1>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="relevance">Most relevant</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Shop rating</option>
          <option value="distance">Nearest first</option>
        </select>
      </div>
      {loading ? (
        <p className="text-stone-500">Searching…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          Nothing found nearby for “{q}”. Try a different word or change your location.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((p) => (
            <ProductCard key={p.merchantProductId} card={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-stone-500">Loading…</p>}>
      <SearchResults />
    </Suspense>
  );
}
