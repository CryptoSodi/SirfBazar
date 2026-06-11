'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';

function CategoryProducts() {
  const { id } = useParams<{ id: string }>();
  const name = useSearchParams().get('name');
  const { location, resolved } = useLocation();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resolved) return;
    setLoading(true);
    api
      .get(`/products/nearby?categoryId=${id}&pageSize=48&${locationQuery(location)}`)
      .then((res) => setItems(res.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [id, resolved, location?.latitude]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{name ?? 'Category'}</h1>
      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">No products in this category near you yet.</div>
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

export default function CategoryPage() {
  return (
    <Suspense fallback={<p className="text-stone-500">Loading…</p>}>
      <CategoryProducts />
    </Suspense>
  );
}
