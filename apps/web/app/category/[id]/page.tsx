'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductImage } from '@/components/ProductCard';

interface CatalogItem {
  productId: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  size?: string | null;
}

function CategoryProducts() {
  const { id } = useParams<{ id: string }>();
  const name = useSearchParams().get('name');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Browse the full SirfBazar catalog for this category (not limited to what
    // nearby shops stock). Ordering happens on the product page, from the shops
    // that carry the item.
    api
      .get(`/products/catalog?categoryId=${id}&pageSize=60`)
      .then((res) => {
        setItems(res.items ?? []);
        setTotal(res.total ?? (res.items ?? []).length);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{name ?? 'Category'}</h1>
        {!loading && <span className="text-sm text-stone-400">{total} products</span>}
      </div>
      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">No products in this category yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((p) => (
            <Link key={p.productId} href={`/product/${p.productId}`} className="card flex flex-col overflow-hidden hover:border-emerald-300">
              <ProductImage name={p.name} imageUrl={p.imageUrl} className="h-32 w-full" />
              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</div>
                <div className="text-xs text-stone-500">
                  {[p.brand, p.size ?? p.unit].filter(Boolean).join(' · ')}
                </div>
                <span className="mt-auto pt-2 text-xs font-semibold text-emerald-700">View shops →</span>
              </div>
            </Link>
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
