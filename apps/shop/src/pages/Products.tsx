import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, pkr } from '../lib/api';
import { Modal, btnCls, btnGhost, inputCls, useToast } from '../components/ui';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { CardSkeleton, InlineSkeleton, LoadingFrame } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';
import { readListingsPage, type MerchantListing, type Paged } from '../lib/merchant-contracts';

/** A merchant's own product listing row (GET /merchant/products). */
type MP = MerchantListing;
type CatalogItem = { productId: string; name: string; brand?: string | null; imageUrl?: string | null; unit?: string | null; size?: string | null; category?: { name?: string | null }; alreadyListed: boolean };
type CatalogResult = { items: CatalogItem[]; total: number; totalPages: number };
type CatalogCategory = { id: string; name: string; children?: CatalogCategory[] };

function ProductViewTabs({ view, onChange }: { view: 'catalog' | 'shop'; onChange: (view: 'catalog' | 'shop') => void }) {
  return <div className="product-view-tabs" role="group" aria-label="Product view"><button type="button" className={view === 'catalog' ? 'active' : ''} aria-pressed={view === 'catalog'} onClick={() => onChange('catalog')}>Browse catalog</button><button type="button" className={view === 'shop' ? 'active' : ''} aria-pressed={view === 'shop'} onClick={() => onChange('shop')}>My shop listings</button></div>;
}

function CatalogPage({ onView, onAdded, toast }: { onView: (view: 'catalog' | 'shop') => void; onAdded: () => void; toast: (text: string, ok?: boolean) => void }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<CatalogCategory[]>(() => readMemory<CatalogCategory[]>('catalog:categories') ?? []);
  const [categoryError, setCategoryError] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogResult | null>(() => readMemory<CatalogResult>('catalog:1::') ?? null);
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<CatalogItem | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    api.get('/products/categories')
      .then((response: CatalogCategory[]) => {
        if (!active) return;
        setCategories(response);
        writeMemory('catalog:categories', response);
      })
      .catch((cause: Error) => { if (active) setCategoryError(cause.message || 'Categories could not be loaded.'); });
    return () => { active = false; };
  }, []);

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
  }, [page, query, categoryId, revision]);

  const onItemAdded = () => {
    if (!adding) return;
    toast(`${adding.name} added to your shop`);
    setAdding(null);
    onAdded();
    setRevision((value) => value + 1);
  };

  return <div>
    <section className="page-heading">
      <div><div className="kicker">Catalogue &amp; inventory</div><h1>Products</h1><p>Browse the shared catalog, then add products with your shop's price and stock.</p></div>
      <div className="heading-actions"><input className={inputCls} type="search" aria-label="Search catalog" placeholder="Search catalog products…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    </section>
    <ProductViewTabs view="catalog" onChange={onView} />
    <div className="catalog-layout">
    <aside className="catalog-categories" aria-label="Catalog categories"><h2>Categories</h2><button type="button" className={!categoryId ? 'active' : ''} aria-pressed={!categoryId} onClick={() => { setCategoryId(''); setPage(1); }}>All products</button>{categories.map((category) => <button type="button" key={category.id} className={categoryId === category.id ? 'active' : ''} aria-pressed={categoryId === category.id} onClick={() => { setCategoryId(category.id); setPage(1); }}>{category.name}</button>)}{categoryError && <p role="alert">{categoryError}</p>}</aside>
    <div className="catalog-results"><div className="catalog-summary">{result ? `${result.total.toLocaleString()} products${categoryId ? ` in ${categories.find((category) => category.id === categoryId)?.name ?? 'this category'}` : ''}` : 'Loading catalog products…'}{loading && result && <span className="muted"> · Refreshing…</span>}</div>
    {error && <div className="panel catalog-error" role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    {loading && !result ? <LoadingFrame label="Loading catalog products"><div className="catalog-grid">{Array.from({ length: 8 }, (_, index) => <CardSkeleton key={index} />)}</div></LoadingFrame> : null}
    {result && result.items.length > 0 && <div className="catalog-grid">{result.items.map((item) => <article className="catalog-card" key={item.productId}>
      <div className="catalog-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <ReferenceIcon name="package" size="lg" />}</div>
      <div className="catalog-card-body"><span className="catalog-category">{item.category?.name || 'Product'}</span><h2 title={item.name}>{item.name}</h2><p>{[item.brand, item.size ?? item.unit].filter(Boolean).join(' · ') || 'Catalog item'}</p>
        {item.alreadyListed ? <button type="button" className="btn" onClick={() => onView('shop')}>In my shop →</button> : <button type="button" className="btn primary" onClick={() => setAdding(item)}>Add to my shop</button>}
      </div>
    </article>)}</div>}
    {!loading && result?.items.length === 0 && !error && <div className="panel catalog-empty">{query ? `No catalog products match “${query}”.` : 'The catalog is empty.'}</div>}
    {result && result.totalPages > 1 && <nav className="catalog-pagination" aria-label="Catalog pages"><button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><span>Page {page} of {result.totalPages}</span><button type="button" className="btn" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next →</button></nav>}
    </div></div>
    {adding && <AddCatalogItem item={adding} onCancel={() => setAdding(null)} onAdded={onItemAdded} toast={toast} />}
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

  if (view === 'catalog') return <><CatalogPage onView={setView} onAdded={() => setRevision((value) => value + 1)} toast={toast} />{node}</>;

  return (
    <div>
      <section className="page-heading">
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

      {result && result.totalPages > 1 && <nav className="catalog-pagination" aria-label="Shop listing pages"><button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><span>Page {page} of {result.totalPages}</span><button type="button" className="btn" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next →</button></nav>}

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
      {bulkOpen && <BulkUploadModal onClose={() => setBulkOpen(false)} onSaved={() => { setBulkOpen(false); setRevision((value) => value + 1); }} toast={toast} />}
      {node}
    </div>
  );
}

function BulkUploadModal({ onClose, onSaved, toast }: { onClose: () => void; onSaved: () => void; toast: (text: string, ok?: boolean) => void }) {
  const [value, setValue] = useState('name,priceRupees,stockQuantity\nBasmati Rice,650,20\nFresh Milk,320,15');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    try {
      const trimmed = value.trim();
      let items: any[];
      if (trimmed.startsWith('[')) items = JSON.parse(trimmed);
      else {
        const rows = trimmed.split(/\r?\n/).filter(Boolean);
        const header = rows.shift()?.split(',').map((cell) => cell.trim()) ?? [];
        items = rows.map((row) => {
          const record = Object.fromEntries(row.split(',').map((cell, index) => [header[index], cell.trim()]));
          return {
            ...(record.productId ? { productId: record.productId } : {}),
            ...(record.name ? { name: record.name } : {}),
            ...(record.categoryId ? { categoryId: record.categoryId } : {}),
            ...(record.unit ? { unit: record.unit } : {}),
            pricePaisa: Math.round(Number(record.priceRupees) * 100),
            stockQuantity: Math.round(Number(record.stockQuantity)),
          };
        });
      }
      if (!items.length) throw new Error('Add at least one product row.');
      setBusy(true);
      const result = await api.post('/merchant/products/bulk-upload', { items });
      const failed = Array.isArray(result.failed) ? result.failed : [];
      toast(`Import complete: ${result.created ?? 0} created, ${result.updated ?? 0} updated${failed.length ? `, ${failed.length} failed` : ''}`, failed.length === 0);
      if (failed.length) { setValue(JSON.stringify({ result, failed }, null, 2)); return; }
      onSaved();
    } catch (error: any) { toast(error.message || 'The import could not be parsed.', false); }
    finally { setBusy(false); }
  };
  return <Modal title="Import products" onClose={onClose}><div className="dialog-body space-y-3"><p className="small muted">Paste CSV with columns <b>name, priceRupees, stockQuantity</b>. Exact catalogue names are matched automatically. Advanced imports may use a JSON array with productId or categoryId.</p><textarea className={inputCls} rows={10} value={value} onChange={(event) => setValue(event.target.value)} /><div className="row"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Importing…' : 'Import products'}</button></div></div></Modal>;
}

function Thumb({ name, imageUrl }: { name?: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name ?? ''} className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-lg" aria-hidden>
      🛍️
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
              ←
            </button>
            <span className="text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              className="rounded-lg border border-slate-300 px-2.5 py-1 disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              →
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
