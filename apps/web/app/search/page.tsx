'use client';
import { AppIcon as UiIcon } from '../../components/AppIcon';


import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FALLBACK_LOCATION, locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { CoverageNotice } from '@/components/CoverageNotice';
import { CategoryFilters } from '@/components/CategoryFilters';
import { categoryPath, flattenCategories } from '@/lib/category-tree';

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q')?.trim() || '';
  const category = params.get('category') || '';
  const shopsOnly = params.get('type') === 'shops';
  const { location, resolved, choose } = useLocation();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const sort = ['price_asc', 'price_desc', 'relevance', 'rating', 'distance'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'price_asc';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noCoverage, setNoCoverage] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadedFor, setLoadedFor] = useState('');
  const resultsKey = JSON.stringify([q, category, shopsOnly, sort, resolved, location?.latitude, location?.longitude, reload]);
  const resultsPending = loading || loadedFor !== resultsKey;

  useEffect(() => {
    if (!resolved) return;
    let active = true;
    const query = locationQuery(location);
    setLoading(true); setError(''); setNoCoverage(false);
    (async () => {
      try {
        const cats = await api.get('/products/categories');
        if (!active) return;
        setCategories(cats ?? []);
        const selected = flattenCategories(cats ?? []).find(entry => entry.slug === category || entry.id === category);
        if (category && !selected) throw new Error('This category is no longer available. Choose another category.');
        const categoryParam = selected ? `&categoryId=${encodeURIComponent(selected.id)}` : '';
        let hasResults = false;
        if (shopsOnly) {
          const response = await api.get(`/merchants/nearby?${query}${categoryParam}`);
          hasResults = (response.items ?? response ?? []).length > 0;
          if (active) setShops(response.items ?? response ?? []);
        } else {
          const response = await api.get(`/products/search?q=${encodeURIComponent(q)}&sort=${sort}&pageSize=48&${query}${categoryParam}`);
          hasResults = (response.items ?? []).length > 0;
          if (active) setItems(response.items ?? []);
        }
        if (!hasResults) {
          const nearby = await api.get(`/merchants/nearby?${query}&pageSize=1`);
          if (active) setNoCoverage((nearby.total ?? nearby.items?.length ?? 0) === 0);
        }
      } catch (cause: any) {
        if (active) setError(cause.message || 'Unable to load local results. Try again.');
      } finally { if (active) { setLoadedFor(resultsKey); setLoading(false); } }
    })();
    return () => { active = false; };
  }, [q, category, shopsOnly, sort, resolved, location?.latitude, location?.longitude, reload]);

  const filterHref = (slug: string) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (shopsOnly) next.set('type', 'shops');
    if (slug) next.set('category', slug);
    if (sort !== 'price_asc') next.set('sort', sort);
    return `/search${next.size ? `?${next.toString()}` : ''}`;
  };
  const changeSort = (nextSort: string) => {
    const next = new URLSearchParams(params.toString());
    if (nextSort === 'price_asc') next.delete('sort'); else next.set('sort', nextSort);
    router.push(`/search?${next.toString()}`);
  };
  const path = categoryPath(categories, category);
  const selectedCategory = path.at(-1);
  const section = selectedCategory?.children?.length ? selectedCategory : path.at(-2);
  const filters = <div className="sb-browse-filter-content"><h2>Categories</h2><Link className={!category ? 'selected' : ''} href={filterHref('')}><Icon name="grid" size={16} /> All essentials</Link><CategoryFilters categories={categories} selected={category} href={filterHref} /><p>Prices belong to the selected shop. Check alternatives on each product page.</p></div>;

  return <div className="sb-browse"><nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><span>{shopsOnly ? 'Local shops' : 'All essentials'}</span></nav><h1>{shopsOnly ? 'Your neighbourhood shops' : q ? `Results for “${q}”` : 'Find your everyday essentials'}</h1><p className="sb-muted">{shopsOnly ? 'Shops prepare and deliver their own orders.' : 'Shop by product. Keep your local shop in view.'}</p>
    <div className="sb-browse-tabs"><Link href="/search" className={!shopsOnly ? 'active' : ''}>Products</Link><Link href="/search?type=shops" className={shopsOnly ? 'active' : ''}>Local shops</Link></div>
    {section && <section className="sb-category-sections" aria-labelledby="category-section-title"><h2 id="category-section-title">{selectedCategory?.name ?? section.name}</h2><nav aria-label={`Subsections of ${section.name}`}><Link href={filterHref(section.slug)} aria-current={selectedCategory?.id === section.id ? 'page' : undefined}>All {section.name}</Link>{section.children?.map(child => <Link key={child.id} href={filterHref(child.slug)} aria-current={selectedCategory?.id === child.id ? 'page' : undefined}>{child.name}</Link>)}</nav></section>}
    <div className="sb-browse-grid"><aside className="card sb-browse-filters"><h2>Refine your list</h2>{filters}</aside><div className="sb-browse-results"><div className="sb-browse-toolbar"><span role="status" aria-live="polite">{resultsPending ? 'Loading local results…' : error ? 'Results unavailable' : `${shopsOnly ? shops.length : items.length} nearby ${shopsOnly ? 'shops' : 'products'}`}</span><details className="sb-mobile-filters"><summary>Filters</summary>{filters}</details>{!shopsOnly && <><label className="sr-only" htmlFor="browse-sort">Sort products</label><select id="browse-sort" className="input" value={sort} onChange={(event) => changeSort(event.target.value)}><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="relevance">Most relevant</option><option value="rating">Shop rating</option><option value="distance">Nearest first</option></select></>}</div>
      {error && !resultsPending ? <div role="alert" className="card p-5"><p>{error}</p><button className="btn-secondary mt-3" onClick={() => setReload((value) => value + 1)}>Try again</button></div> : resultsPending ? <div className="sb-product-grid" aria-label="Loading results">{Array.from({ length:8 }).map((_, index) => <div key={index} className="card sb-product-skeleton" />)}</div> : noCoverage ? <CoverageNotice inExampleArea={location?.label === FALLBACK_LOCATION.label} onBrowseExample={() => choose(FALLBACK_LOCATION)} onRetry={() => setReload((value) => value + 1)} /> : shopsOnly ? shops.length ? <div className="sb-browse-shop-grid">{shops.map((shop) => <Link key={shop.id} href={`/shop/${shop.id}`} className="card sb-browse-shop"><Icon name="shop" size={28} /><strong>{shop.shopName}</strong><small>{shop.city || 'Local shop'}</small><small>{shop.isOnline && shop.isOpen ? 'Open' : 'Closed'}{shop.estimatedDeliveryMinutes ? ` · ${shop.estimatedDeliveryMinutes} min estimate` : ''}</small><b>View shop&nbsp; <UiIcon name="arrow" size={18} /></b></Link>)}</div> : <p className="card p-6">No shops match these filters. Clear filters to see available shops.</p> : items.length ? <div className="sb-product-grid">{items.map((product) => <ProductCard key={product.merchantProductId} card={product} />)}</div> : <div className="card p-6"><h2 className="font-bold">No nearby products found</h2><p className="sb-muted mt-2">Try another search term, category or delivery area.</p><Link className="btn-secondary mt-4 inline-flex" href="/search">Clear filters</Link></div>}
    </div></div>
  </div>;
}

export default function SearchPage() { return <Suspense fallback={<p role="status">Loading browse…</p>}><SearchResults /></Suspense>; }
