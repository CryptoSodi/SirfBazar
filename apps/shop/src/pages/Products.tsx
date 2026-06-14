import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { Modal, Table, btnCls, btnGhost, inputCls, useToast } from '../components/ui';

/** A merchant's own product listing row (GET /merchant/products). */
type MP = any;

export default function Products() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<MP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<MP | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const { toast, node } = useToast();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (q.trim()) qs.set('q', q.trim());
      const res = await api.get(`/merchant/products?${qs.toString()}`);
      setItems(Array.isArray(res) ? res : (res.items ?? []));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search: reload shortly after the query settles.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggleAvailability = async (mp: MP) => {
    try {
      await api.put(`/merchant/products/${mp.id}`, { isAvailable: !mp.isAvailable });
      toast(mp.isAvailable ? 'Hidden from store' : 'Listed in store');
      load();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={`${btnCls} ml-auto`} onClick={() => setCatalogOpen(true)}>
          + Add from catalog
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <Table headers={['Product', 'Category', 'Price', 'Stock', 'Availability', '']}>
        {items.map((mp) => {
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
                      {[p.brand, p.size ?? p.unit].filter(Boolean).join(' · ') || '—'}
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
              <td className="px-4 py-2.5">
                <button
                  onClick={() => toggleAvailability(mp)}
                  className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition ${
                    mp.isAvailable ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-300'
                  }`}
                  title={mp.isAvailable ? 'Available — click to hide' : 'Hidden — click to list'}
                >
                  <span className="h-4 w-4 rounded-full bg-white shadow" />
                </button>
              </td>
              <td className="px-4 py-2.5 text-right">
                <button className={btnGhost} onClick={() => setEditing(mp)}>
                  Edit
                </button>
              </td>
            </tr>
          );
        })}
        {!loading && items.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
              {q ? 'No products match your search.' : 'No products yet — add some from the catalog.'}
            </td>
          </tr>
        )}
        {loading && (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
              Loading…
            </td>
          </tr>
        )}
      </Table>

      {editing && (
        <EditModal
          mp={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          toast={toast}
        />
      )}
      {catalogOpen && (
        <CatalogModal
          onClose={() => setCatalogOpen(false)}
          onAdded={load}
          toast={toast}
        />
      )}
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
      await api.put(`/merchant/products/${mp.id}`, { pricePaisa, stockQuantity });
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
          {loading && <p className="py-8 text-center text-slate-400">Loading…</p>}
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
