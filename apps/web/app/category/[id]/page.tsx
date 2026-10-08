'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';
import Link from 'next/link';
import { CategoryNode, flattenCategories } from '@/lib/category-tree';

function CategoryProducts() {
  const { id } = useParams<{ id: string }>();
  const name = useSearchParams().get('name');
  const { location, resolved } = useLocation();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryNode>();
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!resolved) return;
    let active = true;
    setLoading(true);
    setError('');
    // Dynamic/hyperlocal: only products stocked by approved shops near the user.
    Promise.all([
      api.get(`/products/nearby?categoryId=${encodeURIComponent(id)}&pageSize=48&${locationQuery(location)}`),
      api.get('/products/categories'),
    ]).then(([res, categories]) => { if (active) { setItems(res.items ?? []); setCategory(flattenCategories(categories ?? []).find(c => c.id === id)); } })
      .catch(() => { if (active) setError('Unable to load this category. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, resolved, location?.latitude, location?.longitude, reload]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{category?.name ?? name ?? 'Category'}</h1>
      {!!category?.children?.length && <nav aria-label="Subcategories" className="mb-6 flex flex-wrap gap-3">{category.children.map(child => <Link key={child.id} className="btn-secondary" href={`/category/${encodeURIComponent(child.id)}?name=${encodeURIComponent(child.name)}`}>{child.name}</Link>)}</nav>}
      {error ? <div role="alert" className="card p-6"><p>{error}</p><button className="btn-secondary mt-3" onClick={() => setReload(n => n + 1)}>Try again</button></div> : loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">No shops near you stock this category yet.</div>
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
