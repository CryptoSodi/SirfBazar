import { ReferenceIcon as UiIcon } from '../components/ReferenceIcon';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, pkr } from '../lib/api';
import { Modal, btnCls, btnGhost, inputCls, useToast } from '../components/ui';
import { ReferenceIcon, type ReferenceIconName } from '../components/ReferenceIcon';
import { CardSkeleton, InlineSkeleton, LoadingFrame } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';
import { readListingsPage, type MerchantListing, type Paged } from '../lib/merchant-contracts';
import BulkImport from '../components/BulkImport';
import { parseRupees, parseStock, type BulkItem, type UploadResult } from '../lib/bulk-import';
import { categoryPath, type CatalogCategory } from '../lib/catalog-categories';
import './catalog-workspace.css';

/** A merchant's own product listing row (GET /merchant/products). */
type MP = MerchantListing;
type CatalogItem = { productId: string; name: string; brand?: string | null; imageUrl?: string | null; unit?: string | null; size?: string | null; category?: { name?: string | null }; alreadyListed: boolean };
type CatalogResult = { items: CatalogItem[]; total: number; totalPages: number };
type Selection = { item: CatalogItem; price: string; stock: string; error?: string; invalidField?: 'price' | 'stock' };

function categoryGlyph(name: string): ReferenceIconName {
  if (/fruit|vegetable/i.test(name)) return 'carrot';
  if (/milk|dairy|egg/i.test(name)) return 'milk';
  if (/bakery|bread/i.test(name)) return 'bakery';
  if (/drink|beverage/i.test(name)) return 'drink';
  if (/care|beauty/i.test(name)) return 'care';
  if (/household|clean/i.test(name)) return 'household';
  if (/baby/i.test(name)) return 'baby';
  return 'package';
}

function CatalogPicture({ item }: { item: CatalogItem }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.imageUrl]);
  return item.imageUrl && !failed
    ? <img src={item.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <span className="catalog-picture-fallback"><ReferenceIcon name="package" size="lg" /><span>Image unavailable</span></span>;
}

function CategoryNode({ category, selected, onSelect, depth = 0 }: { category: CatalogCategory; selected: string; onSelect: (id: string) => void; depth?: number }) {
  const [open, setOpen] = useState(false);
  const containsSelection = categoryPath([category], selected).length > 0;
  useEffect(() => { if (containsSelection) setOpen(true); }, [containsSelection]);
  return <div className={`catalog-category-node ${depth ? 'is-subsection' : 'is-department'}`}>
    <div className={`catalog-category-line ${selected === category.id ? 'active' : ''}`}>
      <button type="button" className="catalog-category-name" aria-pressed={selected === category.id} onClick={() => { setOpen(true); onSelect(category.id); }}>
        {!depth && <ReferenceIcon name={categoryGlyph(category.name)} size="sm" />}<span>{category.name}</span>
      </button>
      {!!category.children?.length && <button type="button" className="catalog-disclosure" aria-label={`${open ? 'Collapse' : 'Expand'} ${category.name}`} aria-expanded={open} aria-controls={`category-${category.id}`} onClick={() => setOpen(!open)}><ReferenceIcon name={open ? 'down' : 'right'} size="sm" /></button>}
    </div>
    {!!category.children?.length && <div id={`category-${category.id}`} className="catalog-children" hidden={!open}>{category.children.map((child) => <CategoryNode key={child.id} category={child} selected={selected} onSelect={onSelect} depth={depth + 1} />)}</div>}
  </div>;
}

function ProductViewTabs({ view, onChange }: { view: 'catalog' | 'shop'; onChange: (view: 'catalog' | 'shop') => void }) {
  return <div className="product-view-tabs" role="group" aria-label="Product view"><button type="button" className={view === 'catalog' ? 'active' : ''} aria-pressed={view === 'catalog'} onClick={() => onChange('catalog')}>Browse catalog</button><button type="button" className={view === 'shop' ? 'active' : ''} aria-pressed={view === 'shop'} onClick={() => onChange('shop')}>My shop listings</button></div>;
}

function CatalogPage({ onView, onAdded, onImport, refreshKey }: { onView: (view: 'catalog' | 'shop') => void; onAdded: () => void; onImport: () => void; refreshKey: number }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<CatalogCategory[]>(() => readMemory<CatalogCategory[]>('catalog:categories') ?? []);
  const [categoryError, setCategoryError] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogResult | null>(() => readMemory<CatalogResult>('catalog:1::') ?? null);
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState<UploadResult | null>(null);
  const [bulkRequest, setBulkRequest] = useState<{ requestId: string; items: BulkItem[] } | null>(null);
  const [revision, setRevision] = useState(0);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sort, setSort] = useState('az');
  const reviewRef = useRef<HTMLElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedCount = Object.keys(selected).length;
  const activePath = categoryPath(categories, categoryId);
  const activeCategory = activePath.at(-1);
  const eligibleItems = result?.items.filter((item) => !item.alreadyListed) ?? [];
  const allVisibleSelected = eligibleItems.length > 0 && eligibleItems.every((item) => !!selected[item.productId]);
  const visibleItems = [...(result?.items ?? [])].sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = !allVisibleSelected && eligibleItems.some((item) => !!selected[item.productId]); }, [selected, result, allVisibleSelected]);
  const chooseCategory = (id: string) => { setCategoryId(id); setPage(1); };
  const reviewSelection = () => {
    reviewRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    reviewRef.current?.focus({ preventScroll: true });
  };

  const toggleSelected = (item: CatalogItem) => setSelected((current) => {
    const next = { ...current };
    if (next[item.productId]) delete next[item.productId];
    else if (!item.alreadyListed) next[item.productId] = { item, price: '', stock: '' };
    return next;
  });
  const selectVisible = () => setSelected((current) => {
    const next = { ...current };
    eligibleItems.forEach((item) => {
      if (allVisibleSelected) delete next[item.productId];
      else next[item.productId] ??= { item, price: '', stock: '' };
    });
    return next;
  });
  const submitSelected = async (retry = false) => {
    try {
      let batch = bulkRequest;
      if (!retry || !batch) {
        for (const { item, price, stock } of Object.values(selected)) {
          for (const field of ['price', 'stock'] as const) {
            try { if (field === 'price') parseRupees(price); else parseStock(stock); }
            catch (cause) {
              setSelected((current) => ({ ...current, [item.productId]: { ...current[item.productId], error: errorMessage(cause), invalidField: field } }));
              document.getElementById(`catalog-${field}-${item.productId}`)?.focus();
              return;
            }
          }
        }
        const items = Object.values(selected).map(({ item, price, stock }) => ({ rowId: item.productId, productId: item.productId, pricePaisa: parseRupees(price), stockQuantity: parseStock(stock) }));
        if (!items.length) throw Error('Select at least one available catalogue product.');
        batch = { requestId: crypto.randomUUID(), items }; setBulkRequest(batch);
      }
      setBulkBusy(true); setBulkError('');
      const response = await api.post('/merchant/products/bulk-upload', { ...batch, mode: 'ADD_MISSING' }) as UploadResult;
      if (!Array.isArray(response.rows)) throw Error('The upload response was incomplete. Retry the same request to reconcile it.');
      setBulkResult(response);
      const completed = new Set(response.rows.filter((row) => row.status === 'CREATED' || row.status === 'SKIPPED').map((row) => row.rowId));
      setSelected((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !completed.has(id))));
      if (response.created) { onAdded(); setRevision((value) => value + 1); }
      if (!response.failed.length) setBulkRequest(null);
    } catch (cause) { setBulkError(`${errorMessage(cause)} ${bulkRequest ? 'Retry the same request to reconcile its result.' : 'Check each selected price and stock value.'}`); }
    finally { setBulkBusy(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setCategoryError('');
    api.get('/products/categories')
      .then((response: CatalogCategory[]) => {
        if (!active) return;
        setCategories(response);
        writeMemory('catalog:categories', response);
      })
      .catch((cause: Error) => { if (active) setCategoryError(cause.message || 'Categories could not be loaded.'); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    const cacheKey = `catalog:${page}:${query.toLowerCase()}:${categoryId}`;
    const cached = readMemory<CatalogResult>(cacheKey);
    setResult(cached ?? null);
    setLoading(!cached);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: '24' });
    if (query) params.set('q', query);
    if (categoryId) params.set('categoryId', categoryId);
    api.get(`/merchant/catalog?${params.toString()}`)
      .then((response: CatalogResult) => {
        if (!active) return;
        const next = { items: response.items ?? [], total: response.total ?? 0, totalPages: response.totalPages ?? 1 };
        setResult(next);
        writeMemory(cacheKey, next);
      })
      .catch((cause: Error) => { if (active) setError(cause.message || 'The catalog could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, categoryId, revision, refreshKey]);

  return <div className="catalog-workspace">
    <section className="page-heading">
      <div><h1>Products</h1><p>Find the right products. Set your price. Stock your shop.</p></div>
      <button className="btn catalog-import" type="button" aria-label="Import products" onClick={onImport}><ReferenceIcon name="upload" size="sm" /><span>Import products</span></button>
    </section>
    <ProductViewTabs view="catalog" onChange={onView} />
    <div className="catalog-layout catalog-bulk-layout">
    <aside className={`catalog-categories ${categoriesOpen ? 'is-open' : ''}`} aria-label="Catalog categories">
      <div className="catalog-category-heading"><h2>Categories</h2><span>{categories.length || ''}</span><button className="catalog-mobile-categories" type="button" aria-expanded={categoriesOpen} aria-controls="catalog-category-list" onClick={() => setCategoriesOpen(!categoriesOpen)}>{categoriesOpen ? 'Hide categories' : 'Change category'}<ReferenceIcon name={categoriesOpen ? 'up' : 'down'} size="sm" /></button></div>
      <div id="catalog-category-list"><button type="button" className={`catalog-all ${!categoryId ? 'active' : ''}`} aria-pressed={!categoryId} onClick={() => chooseCategory('')}><ReferenceIcon name="grid" size="sm" />All products</button>{categories.map((category) => <CategoryNode key={category.id} category={category} selected={categoryId} onSelect={chooseCategory} />)}</div>
      {categoryError && <p role="alert">{categoryError} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry categories</button></p>}
      <div className="catalog-category-help"><strong>A shared catalogue.<br />Your own shop.</strong><p>Select products from any section. Your selection stays here while you browse.</p></div>
    </aside>
    <section className="catalog-results" aria-labelledby="catalog-section-title">
      <div className="catalog-path">{activePath.length > 1 ? activePath.slice(0, -1).map((category) => category.name).join(' / ') : 'Shared catalogue'}<ReferenceIcon name="right" size="sm" /></div>
      <div className="catalog-results-heading"><h2 id="catalog-section-title" className="catalog-section-title">{activeCategory?.name || 'All products'}</h2><div className="catalog-summary" role="status">{result ? `${result.total.toLocaleString()} products${activeCategory?.children?.length ? ' including subsections' : ''}` : 'Loading…'}{loading && result && <span> · Refreshing…</span>}</div></div>
      <div className="catalog-tools"><label className="catalog-search"><span className="sr-only">Search catalog</span><ReferenceIcon name="search" size="sm" /><input className={inputCls} type="search" placeholder="Search this category…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="catalog-sort"><span className="sr-only">Sort products on this page</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="az">A–Z · this page</option><option value="za">Z–A · this page</option></select></label></div>
      <div className="catalog-selection-tools"><label className="catalog-select-visible"><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} disabled={loading || !!error || !eligibleItems.length || !!bulkRequest} onChange={selectVisible} />{allVisibleSelected ? 'Deselect visible' : 'Select visible'}</label><span>Already listed products can’t be selected</span></div>
    {error && <div className="panel catalog-error" role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    {loading && !result ? <LoadingFrame label="Loading catalog products"><div className="catalog-grid">{Array.from({ length: 8 }, (_, index) => <CardSkeleton key={index} />)}</div></LoadingFrame> : null}
    {result && result.items.length > 0 && <div className="catalog-grid">{visibleItems.map((item) => <article className={`catalog-card ${selected[item.productId] ? 'is-selected' : ''} ${item.alreadyListed ? 'is-listed' : ''}`} key={item.productId}>
      <input id={`catalog-pick-${item.productId}`} className="catalog-card-checkbox" type="checkbox" aria-label={item.alreadyListed ? `Already in my shop: ${item.name}` : `Select product: ${item.name}`} disabled={item.alreadyListed || !!bulkRequest || loading || !!error} checked={!!selected[item.productId]} onChange={() => toggleSelected(item)} />
      <label htmlFor={`catalog-pick-${item.productId}`} className="catalog-card-label"><span className="catalog-image"><CatalogPicture item={item} /></span><span className="catalog-card-body"><span className="catalog-product-name">{item.name}</span><span className="catalog-product-meta">{[item.brand, item.size ?? item.unit].filter(Boolean).join(' · ') || item.category?.name || 'Catalog item'}</span><span className="catalog-product-status">{(item.alreadyListed || selected[item.productId]) && <ReferenceIcon name="check" size="sm" />}{item.alreadyListed ? 'In your shop' : selected[item.productId] ? 'Selected' : 'Select product'}</span></span></label>
    </article>)}</div>}
    {!loading && result?.items.length === 0 && !error && <div className="panel catalog-empty"><p>{query ? `No catalog products match “${query}”${activeCategory ? ` in ${activeCategory.name}` : ''}.` : `No products are available${activeCategory ? ` in ${activeCategory.name}` : ''}.`}</p><button type="button" className="btn" onClick={() => { setSearch(''); setQuery(''); setCategoryId(''); setPage(1); }}>Show all products</button></div>}
    {result && result.totalPages > 1 && <nav className="catalog-pagination" aria-label="Catalog pages"><button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><UiIcon name="back" /> Previous</button><span>Page {page} of {result.totalPages}</span><button type="button" className="btn" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next <UiIcon name="arrow" /></button></nav>}
    </section>
    <aside ref={reviewRef} tabIndex={-1} className="catalog-review" aria-label="Selected products">
      <div className="catalog-review-heading"><h2>Ready for your shop <span>{selectedCount}</span></h2><p>Set the selling price and stock for each product.</p></div>
      <div className="catalog-review-items">
        {!selectedCount && <div className="catalog-review-empty"><ReferenceIcon name="basket" size="lg" /><h3>Start with a product</h3><p>Select a product to set its price and stock here.</p></div>}
        {Object.values(selected).map(({ item, price, stock, error: rowError, invalidField }) => <div className="catalog-review-item" key={item.productId}>
          <div className="catalog-review-item-title"><span className="catalog-review-thumb"><CatalogPicture item={item} /></span><div><strong>{item.name}</strong><span>{item.size ?? item.unit ?? item.brand}</span></div><button type="button" className="catalog-remove" disabled={!!bulkRequest} onClick={() => { toggleSelected(item); reviewRef.current?.focus({ preventScroll: true }); }} aria-label={`Remove ${item.name} from selection`}><ReferenceIcon name="close" size="sm" /></button></div>
          <div className="catalog-review-fields">
            <label htmlFor={`catalog-price-${item.productId}`}>Sale price (Rs)<input id={`catalog-price-${item.productId}`} className={inputCls} aria-label={`Sale price (Rs) for ${item.name}`} aria-invalid={invalidField === 'price' || undefined} aria-describedby={rowError ? `catalog-error-${item.productId}` : undefined} inputMode="decimal" placeholder="0.00" value={price} disabled={!!bulkRequest} onChange={(event) => setSelected((current) => ({ ...current, [item.productId]: { ...current[item.productId], price: event.target.value, error: undefined, invalidField: undefined } }))} /></label>
            <label htmlFor={`catalog-stock-${item.productId}`}>Stock quantity<input id={`catalog-stock-${item.productId}`} className={inputCls} aria-label={`Stock quantity for ${item.name}`} aria-invalid={invalidField === 'stock' || undefined} aria-describedby={rowError ? `catalog-error-${item.productId}` : undefined} inputMode="numeric" placeholder="0" value={stock} disabled={!!bulkRequest} onChange={(event) => setSelected((current) => ({ ...current, [item.productId]: { ...current[item.productId], stock: event.target.value, error: undefined, invalidField: undefined } }))} /></label>
          </div>{rowError && <p className="catalog-field-error" id={`catalog-error-${item.productId}`} role="alert">{rowError}</p>}
        </div>)}
      </div>
      <p className="catalog-selection-note"><ReferenceIcon name="info" size="sm" />Selections stay when you change categories.</p>
      <div className="catalog-review-footer">
        <div className="catalog-review-total" role="status"><span>Products selected</span><strong>{selectedCount}</strong></div>
        {bulkError && <ToastMessage>{bulkError}</ToastMessage>}
        {bulkResult && <div className="catalog-bulk-result" role="status"><p>{bulkResult.created} added · {bulkResult.skipped} skipped · {bulkResult.failed.length} failed</p>{bulkResult.rows.filter((row) => row.error).map((row) => <p key={row.rowId}>{selected[row.rowId]?.item.name || row.rowId}: {row.error}</p>)}</div>}
        {bulkRequest ? <><p className="catalog-retry-note">This selection is locked until its saved result is checked.</p><button type="button" className="btn primary" disabled={bulkBusy} onClick={() => void submitSelected(true)}>{bulkBusy ? 'Checking…' : 'Retry same selection'}</button>{bulkResult?.failed.length ? <button type="button" className="btn" disabled={bulkBusy} onClick={() => { setBulkRequest(null); setBulkResult(null); setBulkError(''); }}>Edit failed rows</button> : null}</> : <button type="button" className="btn primary" disabled={bulkBusy} onClick={() => void submitSelected()}>{bulkBusy ? 'Adding…' : `Add ${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} to shop`}<ReferenceIcon name="arrow" size="sm" /></button>}
        <p className="catalog-action-note">Products are added only after the server confirms.</p>
      </div>
    </aside>
    </div>
    <div className="catalog-mobile-review"><span><strong>{selectedCount}</strong> selected</span><button className="btn primary" type="button" onClick={reviewSelection}>Review selection<ReferenceIcon name="arrow" size="sm" /></button></div>
  </div>;
}

export default function Products() {
  const [view, setView] = useState<'catalog' | 'shop'>('catalog');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const initialProducts = readMemory<Paged<MP>>('products:1::all');
  const [result, setResult] = useState<Paged<MP> | null>(initialProducts ?? null);
  const [items, setItems] = useState<MP[]>(initialProducts?.items ?? []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<MP | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'paused'>('all');
  const requestNumber = useRef(0);
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { toast, node } = useToast();

  const load = async () => {
    const current = ++requestNumber.current;
    const cacheKey = `products:${page}:${query.toLowerCase()}:${filter}`;
    const cachedProducts = readMemory<Paged<MP>>(cacheKey);
    setResult(cachedProducts ?? null);
    setItems(cachedProducts?.items ?? []);
    setLoading(!cachedProducts);
    setError('');
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: '24' });
      if (query) qs.set('q', query);
      if (filter === 'low') qs.set('lowStock', 'true');
      if (filter === 'paused') qs.set('isAvailable', 'false');
      const next = await api.getParsed(`/merchant/products?${qs.toString()}`, readListingsPage);
      if (current !== requestNumber.current) return;
      setResult(next);
      setItems(next.items);
      setUpdatedAt(new Date());
      writeMemory(cacheKey, next);
    } catch (e: unknown) {
      if (current === requestNumber.current) setError(errorMessage(e));
    } finally {
      if (current === requestNumber.current) setLoading(false);
    }
  };

  // Debounce server-side search; each filter and page has a separate cache key.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQuery(q.trim()); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { void load(); return () => { requestNumber.current++; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, filter, revision]);
  useEffect(() => { const refresh = () => setRevision((value) => value + 1); window.addEventListener('sb:products', refresh); return () => window.removeEventListener('sb:products', refresh); }, []);

  const toggleAvailability = async (mp: MP) => {
    try {
      await api.put(`/merchant/products/${mp.id}`, { isAvailable: !mp.isAvailable });
      toast(mp.isAvailable ? 'Hidden from store' : 'Listed in store');
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  const removeListing = async (mp: MP) => {
    const name = mp.product?.name ?? 'this product';
    if (!confirm(`Remove ${name} from your storefront? Existing order records will be preserved.`)) return;
    try {
      await api.del(`/merchant/products/${mp.id}`);
      toast(`${name} removed from the storefront`);
    } catch (e: any) { toast(e.message, false); }
  };

  const visible = items;

  if (view === 'catalog') return <><CatalogPage onView={setView} onAdded={() => setRevision((value) => value + 1)} onImport={() => setBulkOpen(true)} refreshKey={revision} />{bulkOpen && <BulkImport onClose={() => setBulkOpen(false)} onSaved={() => setRevision((value) => value + 1)} />}{node}</>;

  return (
    <div className="products-shop">
      <section className="page-heading products-shop-heading">
        <div><div className="kicker">Catalogue &amp; inventory</div><h1>Products</h1><p>Keep your catalogue useful, your pricing clear and your stock accurate.</p></div>
        <div className="heading-actions">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="button" onClick={() => setBulkOpen(true)}><ReferenceIcon name="upload" size="sm" /> Import products</button>
        <button className="btn primary" onClick={() => setCatalogOpen(true)}>
          <ReferenceIcon name="plus" size="sm" /> Add product
        </button>
        </div>
      </section>

      <ProductViewTabs view="shop" onChange={setView} />

      <div className="mini-stats"><span><b className="num">{result?.total ?? 0}</b> {filter === 'all' ? 'listings' : filter === 'low' ? 'low-stock listings' : 'paused listings'}</span><span>Page {page} of {Math.max(1, result?.totalPages ?? 1)}</span>{updatedAt && <span>Updated {updatedAt.toLocaleTimeString()}</span>}</div>

      <section className="panel">
        <div className="toolbar"><div className="tabs" aria-label="Product filter">{([['all', 'All products'], ['low', 'Low stock'], ['paused', 'Paused']] as const).map(([key, label]) => <button type="button" key={key} className={`tab ${filter === key ? 'active' : ''}`} aria-pressed={filter === key} onClick={() => { setPage(1); setFilter(key); }}>{label}</button>)}</div></div>

      {error && <div className="inline-error" role="alert">Unable to refresh shop listings. {error} {result && 'Showing the last loaded page.'}<button type="button" className="btn tiny" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}

      <div className="table-wrap"><table><thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Threshold</th><th scope="col">Listing</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {visible.map((mp) => {
          const p = mp.product ?? {};
          const lowStock = mp.lowStockThreshold != null && mp.stockQuantity <= mp.lowStockThreshold;
          const hasDiscount = mp.discountPricePaisa != null;
          return (
            <tr key={mp.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Thumb name={p.name} imageUrl={p.imageUrl} />
                  <div>
                    <div className="font-medium text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      {[p.brand, p.size ?? p.unit, mp.merchantSku ? `SKU ${mp.merchantSku}` : null].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{p.category?.name ?? '—'}</td>
              <td className="px-4 py-2.5">
                {hasDiscount ? (
                  <div>
                    <span className="font-semibold text-emerald-700">{pkr(mp.discountPricePaisa)}</span>
                    <span className="ml-1.5 text-xs text-slate-400 line-through">{pkr(mp.pricePaisa)}</span>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-800">{pkr(mp.pricePaisa)}</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className={lowStock ? 'font-semibold text-amber-600' : 'text-slate-700'}>
                  {mp.stockQuantity}
                </span>
                {lowStock && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Low
                  </span>
                )}
              </td>
              <td className="num">{mp.lowStockThreshold ?? 0} units</td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={mp.isAvailable}
                  aria-label={`${mp.product.name}: ${mp.isAvailable ? 'available' : 'paused'}`}
                  onClick={() => toggleAvailability(mp)}
                  className={`inline-flex h-7 w-11 items-center rounded-full px-1 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                    mp.isAvailable ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-300'
                  }`}
                  title={mp.isAvailable ? 'Available — click to hide' : 'Hidden — click to list'}
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </td>
              <td className="px-4 py-2.5 text-right">
                <button className={btnGhost} onClick={() => setEditing(mp)}>
                  Edit
                </button>
                <button className="btn tiny danger" onClick={() => void removeListing(mp)}>Remove</button>
              </td>
            </tr>
          );
        })}
        {!loading && visible.length === 0 && !error && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
              {q ? 'No products match your search.' : 'No products yet — add some from the catalog.'}
            </td>
          </tr>
        )}
        {loading && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
              <InlineSkeleton label="Loading shop listings" rows={4} />
            </td>
          </tr>
        )}
      </tbody></table></div>
      <div className="panel-foot"><span>{result?.total ?? 0} matching products · {visible.length} on this page</span><span>Low stock uses each listing’s threshold.</span></div>
      </section>

      {result && result.totalPages > 1 && <nav className="catalog-pagination" aria-label="Shop listing pages"><button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><UiIcon name="back" /> Previous</button><span>Page {page} of {result.totalPages}</span><button type="button" className="btn" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next <UiIcon name="arrow" /></button></nav>}

      {editing && (
        <EditModal
          mp={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((value) => value + 1);
          }}
          toast={toast}
        />
      )}
      {catalogOpen && (
        <CatalogModal
          onClose={() => setCatalogOpen(false)}
          onAdded={() => setRevision((value) => value + 1)}
          toast={toast}
        />
      )}
      {bulkOpen && <BulkImport onClose={() => setBulkOpen(false)} onSaved={() => setRevision((value) => value + 1)} />}
      {node}
    </div>
  );
}

function Thumb({ name, imageUrl }: { name?: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name ?? ''} className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-lg" aria-hidden>
      <UiIcon name="bag" />
    </div>
  );
}

/** Edit price + stock for an existing listing (PUT /merchant/products/:id). */
function EditModal({
  mp,
  onClose,
  onSaved,
  toast,
}: {
  mp: MP;
  onClose: () => void;
  onSaved: () => void;
  toast: (t: string, ok?: boolean) => void;
}) {
  // Edit in rupees for usability; convert to paisa on save.
  const [price, setPrice] = useState(String(Math.round((mp.pricePaisa ?? 0) / 100)));
  const [stock, setStock] = useState(String(mp.stockQuantity ?? 0));
  const [sku, setSku] = useState(String(mp.merchantSku ?? ''));
  const [busy, setBusy] = useState(false);
  const p = mp.product ?? {};

  const save = async () => {
    const pricePaisa = Math.round(Number(price) * 100);
    const stockQuantity = Math.round(Number(stock));
    if (!Number.isFinite(pricePaisa) || pricePaisa < 1) {
      toast('Enter a valid price', false);
      return;
    }
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      toast('Enter a valid stock quantity', false);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/merchant/products/${mp.id}`, { pricePaisa, stockQuantity, merchantSku: sku.trim() || null });
      toast('Listing updated');
      onSaved();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit ${p.name ?? 'product'}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <Thumb name={p.name} imageUrl={p.imageUrl} />
          <div>
            <div className="font-medium text-slate-800">{p.name}</div>
            <div className="text-xs text-slate-400">
              {[p.brand, p.size ?? p.unit].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Merchant SKU</label>
          <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. MILK-1L-001" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Price (Rs)</label>
          <input
            className={inputCls}
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Stock quantity</label>
          <input
            className={inputCls}
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
        <button className={`${btnCls} w-full`} onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
import { ToastMessage } from '../components/Toast';

/** Browse the shared catalog of unlisted products and add them to the shop. */
function CatalogModal({
  onClose,
  onAdded,
  toast,
}: {
  onClose: () => void;
  onAdded: () => void;
  toast: (t: string, ok?: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        unlistedOnly: 'true',
      });
      if (q.trim()) qs.set('q', q.trim());
      const res = await api.get(`/merchant/catalog?${qs.toString()}`);
      setRows(res.items ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  // Reset to first page when the search changes.
  useEffect(() => {
    setPage(1);
  }, [q]);

  return (
    <Modal title="Add from catalog" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <input
          className={inputCls}
          placeholder="Search catalog…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {rows.map((c) => (
            <div
              key={c.productId}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
            >
              <Thumb name={c.name} imageUrl={c.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-800">{c.name}</div>
                <div className="truncate text-xs text-slate-400">
                  {[c.brand, c.size ?? c.unit, c.category?.name].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <button className={btnGhost} onClick={() => setAdding(c)}>
                Add
              </button>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <p className="py-8 text-center text-slate-400">
              {q ? 'No catalog products match.' : 'No more catalog products to add.'}
            </p>
          )}
          {loading && <InlineSkeleton label="Loading catalog products" rows={5} />}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <UiIcon name="back" />
            </button>
            <span className="text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <UiIcon name="arrow" />
            </button>
          </div>
        )}
      </div>

      {adding && (
        <AddCatalogItem
          item={adding}
          onCancel={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            toast(`${adding.name} added to your shop`);
            load();
            onAdded();
          }}
          toast={toast}
        />
      )}
    </Modal>
  );
}

/** Price + stock prompt for adding a catalog product (POST /merchant/products). */
function AddCatalogItem({
  item,
  onCancel,
  onAdded,
  toast,
}: {
  item: any;
  onCancel: () => void;
  onAdded: () => void;
  toast: (t: string, ok?: boolean) => void;
}) {
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const pricePaisa = Math.round(Number(price) * 100);
    const stockQuantity = Math.round(Number(stock));
    if (!Number.isFinite(pricePaisa) || pricePaisa < 1) {
      toast('Enter a valid price', false);
      return;
    }
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      toast('Enter a valid stock quantity', false);
      return;
    }
    setBusy(true);
    try {
      await api.post('/merchant/products', {
        productId: item.productId,
        pricePaisa,
        stockQuantity,
        merchantSku: sku.trim() || undefined,
      });
      onAdded();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Add ${item.name}`} onClose={onCancel}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <Thumb name={item.name} imageUrl={item.imageUrl} />
          <div>
            <div className="font-medium text-slate-800">{item.name}</div>
            <div className="text-xs text-slate-400">
              {[item.brand, item.size ?? item.unit].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Merchant SKU</label>
          <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. MILK-1L-001" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Price (Rs)</label>
          <input
            className={inputCls}
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Stock quantity</label>
          <input
            className={inputCls}
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
        <button className={`${btnCls} w-full`} onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add to shop'}
        </button>
      </div>
    </Modal>
  );
}
