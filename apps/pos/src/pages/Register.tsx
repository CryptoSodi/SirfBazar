import { useEffect, useMemo, useRef, useState } from 'react';
import { api, pkr } from '../lib/api';
import { btnCls, btnGhost, inputCls, Modal, useToast } from '../components/ui';

type Product = {
  merchantProductId: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  barcode: string | null;
  pricePaisa: number;
  stockQuantity: number;
  isAvailable: boolean;
};
type Line = { p: Product; qty: number };

export default function Register() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [charging, setCharging] = useState(false);
  const [tendered, setTendered] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();
  const first = useRef(true);

  const load = (query = q) => {
    setLoading(true);
    api
      .get(`/pos/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)
      .then((r) => setProducts(r))
      .catch((e) => toast(e.message, false))
      .finally(() => setLoading(false));
  };

  // Initial load + debounced search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      load('');
      return;
    }
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const lines = Object.values(cart);
  const subtotalPaisa = lines.reduce((s, l) => s + l.p.pricePaisa * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  const add = (p: Product) => {
    if (!p.isAvailable) return toast(`${p.name} is unavailable`, false);
    if (p.stockQuantity <= 0) return toast(`${p.name} is out of stock`, false);
    setCart((c) => {
      const cur = c[p.merchantProductId]?.qty ?? 0;
      if (cur + 1 > p.stockQuantity) {
        toast(`Only ${p.stockQuantity} of ${p.name} in stock`, false);
        return c;
      }
      return { ...c, [p.merchantProductId]: { p, qty: cur + 1 } };
    });
  };

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const l = c[id];
      if (!l) return c;
      if (qty <= 0) {
        const { [id]: _drop, ...rest } = c;
        return rest;
      }
      if (qty > l.p.stockQuantity) {
        toast(`Only ${l.p.stockQuantity} of ${l.p.name} in stock`, false);
        return c;
      }
      return { ...c, [id]: { ...l, qty } };
    });

  const tenderedPaisa = tendered ? Math.round(parseFloat(tendered) * 100) : 0;
  const changePaisa = tenderedPaisa - subtotalPaisa;

  const openCharge = () => {
    if (!lines.length) return;
    setTendered('');
    setCharging(true);
  };

  const complete = async () => {
    setBusy(true);
    try {
      const sale = await api.post('/pos/sales', {
        items: lines.map((l) => ({ merchantProductId: l.p.merchantProductId, quantity: l.qty })),
        amountTenderedPaisa: tendered ? tenderedPaisa : undefined,
      });
      setReceipt(sale);
      setCharging(false);
      setCart({});
      setTendered('');
      load(); // refresh stock after the sale
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  const quickCash = useMemo(() => {
    // Suggest the exact amount plus the next round notes above it.
    const rupees = Math.ceil(subtotalPaisa / 100);
    const set = new Set<number>([rupees]);
    for (const note of [50, 100, 500, 1000, 5000]) {
      set.add(Math.ceil(rupees / note) * note);
    }
    return [...set].filter((r) => r * 100 >= subtotalPaisa).sort((a, b) => a - b).slice(0, 4);
  }, [subtotalPaisa]);

  return (
    <div className="flex h-[calc(100vh-57px)] min-h-0">
      {/* Product catalogue */}
      <section className="flex min-w-0 flex-1 flex-col p-4">
        <input
          className={`${inputCls} mb-3`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products by name…"
          autoFocus
        />
        {loading ? (
          <p className="mt-8 text-center text-sm text-slate-400">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-400">
            No products. Add items to your shop first, then they'll appear here.
          </p>
        ) : (
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const out = !p.isAvailable || p.stockQuantity <= 0;
              return (
                <button
                  key={p.merchantProductId}
                  onClick={() => add(p)}
                  disabled={out}
                  className={`flex flex-col rounded-xl border bg-white p-3 text-left transition ${
                    out ? 'cursor-not-allowed border-slate-200 opacity-50' : 'border-slate-200 hover:border-emerald-400 hover:shadow-sm'
                  }`}
                >
                  <div className="line-clamp-2 text-sm font-semibold text-slate-800">{p.name}</div>
                  <div className="mt-1 text-emerald-700 font-bold">{pkr(p.pricePaisa)}</div>
                  <div className={`mt-0.5 text-[11px] ${p.stockQuantity <= 5 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {out ? 'Out of stock' : `${p.stockQuantity} in stock · ${p.unit}`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Ticket */}
      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-bold">Current sale</h2>
          {lines.length > 0 && (
            <button className="text-xs text-slate-400 underline hover:text-red-600" onClick={() => setCart({})}>
              Clear
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <p className="mt-10 px-6 text-center text-sm text-slate-400">Tap products to add them to the sale.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lines.map(({ p, qty }) => (
                <li key={p.merchantProductId} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-slate-400">{pkr(p.pricePaisa)} each</div>
                    </div>
                    <div className="text-sm font-semibold">{pkr(p.pricePaisa * qty)}</div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button className={btnGhost} onClick={() => setQty(p.merchantProductId, qty - 1)}>
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                    <button className={btnGhost} onClick={() => setQty(p.merchantProductId, qty + 1)}>
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
            <span className="text-2xl font-black">{pkr(subtotalPaisa)}</span>
          </div>
          <button className={`${btnCls} w-full py-3 text-base`} onClick={openCharge} disabled={!lines.length}>
            Charge {pkr(subtotalPaisa)}
          </button>
        </div>
      </aside>

      {/* Charge (cash) modal */}
      {charging && (
        <Modal title="Cash payment" onClose={() => setCharging(false)}>
          <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-500">Total due</span>
            <span className="text-xl font-black">{pkr(subtotalPaisa)}</span>
          </div>

          <label className="mb-1 block text-xs font-semibold text-slate-500">Cash received</label>
          <input
            className={`${inputCls} text-lg`}
            value={tendered}
            onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quickCash.map((r) => (
              <button key={r} className={btnGhost} onClick={() => setTendered(String(r))}>
                Rs {r.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
            <span className="text-sm font-medium text-emerald-800">Change</span>
            <span className={`text-xl font-black ${changePaisa < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {changePaisa < 0 ? '—' : pkr(changePaisa)}
            </span>
          </div>

          <button
            className={`${btnCls} mt-4 w-full py-3 text-base`}
            onClick={complete}
            disabled={busy || (tendered !== '' && changePaisa < 0)}
          >
            {busy ? 'Completing…' : 'Complete sale'}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">Leave cash blank to record exact tender.</p>
        </Modal>
      )}

      {/* Receipt */}
      {receipt && (
        <Modal title="Sale complete ✓" onClose={() => setReceipt(null)}>
          <div className="text-center">
            <div className="text-xs text-slate-400">Receipt #{receipt.orderNumber}</div>
            <div className="mt-1 text-3xl font-black text-emerald-700">{pkr(receipt.totalAmountPaisa)}</div>
            {receipt.changePaisa > 0 && (
              <div className="mt-1 text-sm text-slate-600">
                Change due <span className="font-bold">{pkr(receipt.changePaisa)}</span>
              </div>
            )}
          </div>
          <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {(receipt.items ?? []).map((it: any) => (
              <li key={it.id} className="flex justify-between px-3 py-2 text-sm">
                <span>
                  {it.quantity} × {it.productNameSnapshot}
                </span>
                <span className="font-medium">{pkr(it.totalPricePaisa)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button className={`${btnGhost} flex-1 py-2.5`} onClick={() => window.print()}>
              🖨 Print
            </button>
            <button className={`${btnCls} flex-1 py-2.5`} onClick={() => setReceipt(null)}>
              New sale
            </button>
          </div>
        </Modal>
      )}

      {node}
    </div>
  );
}
