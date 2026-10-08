import { ToastMessage } from '../components/Toast';
import { ReferenceIcon as UiIcon } from '../components/ReferenceIcon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage, pkr, statusLabel } from '../lib/api';
import { assignableRider, can, readListingsPage, readOrder, readOrdersPage, readProfile, readRiders, type MerchantListing, type MerchantOrder, type MerchantProfile, type MerchantRider, type Paged } from '../lib/merchant-contracts';
import { Badge, Modal, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { InlineSkeleton, TableSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';

const CHIPS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'New', value: 'SENT_TO_MERCHANT' },
  { label: 'Accepted', value: 'MERCHANT_ACCEPTED' },
  { label: 'Preparing', value: 'PREPARING' },
  { label: 'Ready', value: 'READY_FOR_PICKUP' },
  { label: 'Assigned', value: 'RIDER_ASSIGNED' },
  { label: 'On the way', value: 'ON_THE_WAY' },
  { label: 'Delivered', value: 'DELIVERED' },
];

const fmtTime = (d?: string) => (d ? new Date(d).toLocaleString() : '—');
const itemCount = (o: MerchantOrder) => o.items.reduce((n, it) => n + it.quantity, 0);

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const initialOrders = readMemory<Paged<MerchantOrder>>('orders:1:all');
  const [result, setResult] = useState<Paged<MerchantOrder> | null>(initialOrders ?? null);
  const [orders, setOrders] = useState<MerchantOrder[]>(initialOrders?.items ?? []);
  const [loading, setLoading] = useState(!initialOrders);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('order'));
  const { toast, node } = useToast();
  const requestNumber = useRef(0);

  const statusRef = useRef(status);
  statusRef.current = status;

  const load = useCallback(async (showSpinner = true) => {
    const current = ++requestNumber.current;
    const s = statusRef.current;
    const cacheKey = `orders:${page}:${s || 'all'}`;
    const cachedOrders = readMemory<Paged<MerchantOrder>>(cacheKey);
    if (cachedOrders) { setOrders(cachedOrders.items); setResult(cachedOrders); }
    else if (showSpinner) { setOrders([]); setResult(null); }
    if (showSpinner) setLoading(!cachedOrders);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (s) params.set('status', s);
      const next = await api.getParsed(`/merchant/orders?${params.toString()}`, readOrdersPage);
      if (current !== requestNumber.current || statusRef.current !== s) return;
      if (page > Math.max(1, next.totalPages)) { setPage(Math.max(1, next.totalPages)); return; }
      setOrders(next.items);
      setResult(next);
      setUpdatedAt(new Date());
      writeMemory(cacheKey, next);
    } catch (e) {
      if (current === requestNumber.current) { setError(errorMessage(e)); if (!cachedOrders) setOrders([]); }
    } finally {
      if (current === requestNumber.current) setLoading(false);
    }
  }, []);

  // Reload on filter change.
  useEffect(() => {
    load(true);
  }, [status, load]);

  const loadProfile = useCallback(async () => {
    setProfileError('');
    try { setProfile(await api.getParsed('/merchant/profile', readProfile)); }
    catch (e) { setProfile(null); setProfileError(errorMessage(e)); }
  }, [page]);
  useEffect(() => { void loadProfile(); return () => { requestNumber.current++; }; }, [loadProfile]);
  useEffect(() => { const requested = searchParams.get('order'); if (requested) setSelectedId(requested); }, [searchParams]);

  // Refresh visible work periodically; avoid background traffic and stale updates.
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(false); }, 30_000);
    const realtime = () => void load(false);
    window.addEventListener('sb:orders', realtime);
    return () => { clearInterval(id); window.removeEventListener('sb:orders', realtime); };
  }, [load]);

  return (
    <>
      <div className="page-heading"><div><div className="kicker">Manage your shop</div><h1>Orders</h1><p>From the first acceptance to the final handover.</p></div><button className="btn" type="button" onClick={() => load(true)}><ReferenceIcon name="refresh" /> Refresh</button></div>
      <section className="panel"><div className="toolbar" role="group" aria-label="Filter orders by status"><div className="tabs">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={status === c.value}
            onClick={() => { setPage(1); setStatus(c.value); }}
            className={status === c.value ? 'tab active' : 'tab'}
          >
            {c.label}
          </button>
        ))}
      </div></div>

      {error && <div className="inline-error" role="alert">Unable to load orders. {error} <button type="button" className="btn tiny" onClick={() => load(true)}>Retry</button></div>}

      {loading ? <TableSkeleton rows={7} /> : error && orders.length === 0 ? null : orders.length === 0 ? <div className="ops-panel ops-empty">No orders in this status. Choose another filter to continue.</div> : <Table headers={['Order', 'Customer', 'Items', 'Total', 'Status', 'Rider', 'Time', 'Action']}>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2.5 font-mono text-xs font-semibold">{o.orderNumber}</td>
              <td className="px-4 py-2.5">
                {o.customer?.user?.fullName ?? '—'}
                <div className="text-xs text-slate-400">{o.customer?.user?.phoneNumber ?? ''}</div>
              </td>
              <td className="px-4 py-2.5">{itemCount(o)}</td>
              <td className="px-4 py-2.5 font-semibold">{pkr(o.totalAmountPaisa)}</td>
              <td className="px-4 py-2.5"><Badge value={o.status} /></td>
              <td className="px-4 py-2.5 text-sm">{o.rider?.fullName ?? '—'}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{fmtTime(o.createdAt)}</td>
              <td><button type="button" className="ops-button" onClick={() => { setSelectedId(o.id); setSearchParams({ order: o.id }); }} aria-label={`View order ${o.orderNumber}`}>View</button></td>
            </tr>
          ))}
        </Table>
      }

      <div className="panel-foot"><span>{result?.total ?? 0} matching orders · {orders.length} on this page</span><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Newest first'}</span></div></section>
      {result && result.totalPages > 1 && <nav className="catalog-pagination" aria-label="Order pages"><button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><UiIcon name="back" /> Previous</button><span>Page {page} of {result.totalPages}</span><button type="button" className="btn" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next <UiIcon name="arrow" /></button></nav>}

      {selectedId && (
        <OrderModal
          orderId={selectedId}
          profile={profile}
          profileError={profileError}
          retryProfile={loadProfile}
          onClose={() => { setSelectedId(null); setSearchParams({}); }}
          toast={toast}
          reload={() => load(false)}
        />
      )}
      {node}<div className="footer-note"><span>Ordered on SirfBazar. Prepared by your shop.</span><span>Live merchant API</span></div>
    </>
  );
}

function OrderModal({
  orderId,
  profile,
  profileError,
  retryProfile,
  onClose,
  toast,
  reload,
}: {
  orderId: string;
  profile: MerchantProfile | null;
  profileError: string;
  retryProfile: () => void;
  onClose: () => void;
  toast: (text: string, ok?: boolean) => void;
  reload: () => void;
}) {
  const [order, setOrder] = useState<MerchantOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [riders, setRiders] = useState<MerchantRider[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [ridersError, setRidersError] = useState('');
  const [riderId, setRiderId] = useState('');
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [unavailableItem, setUnavailableItem] = useState<any | null>(null);

  const loadOrder = useCallback(async () => {
    const fresh = await api.getParsed(`/merchant/orders/${orderId}`, readOrder);
    setOrder(fresh);
    setDetailError('');
    setUncertain(false);
    return fresh;
  }, [orderId]);

  useEffect(() => {
    setDetailLoading(true);
    loadOrder().catch((e) => setDetailError(errorMessage(e))).finally(() => setDetailLoading(false));
  }, [loadOrder]);

  const act = async (action: string, expectedStatus: string, okMsg: string, body?: unknown) => {
    setBusy(true);
    setActionError('');
    const confirmed = (fresh: MerchantOrder) => fresh.status === expectedStatus &&
      (action !== 'assign-rider' || fresh.rider?.id === (body as { riderId: string }).riderId);
    try {
      const result = await api.post(`/merchant/orders/${orderId}/${action}`, body);
      if (result?.ok !== true || result.status !== expectedStatus) throw new Error('The service did not confirm the expected order status.');
      const fresh = await loadOrder();
      reload();
      if (!confirmed(fresh)) throw new Error('The order changed while this action was being confirmed.');
      toast(okMsg);
      setConfirmAssign(false);
      setRejecting(false);
    } catch (e) {
      try {
        const fresh = await loadOrder();
        reload();
        if (confirmed(fresh)) { toast(`Latest order state confirmed: ${statusLabel(expectedStatus)}`); setConfirmAssign(false); setRejecting(false); return; }
        setActionError(`${errorMessage(e)} The latest order state is shown. Review it before trying again.`);
      } catch {
        setUncertain(true);
        setActionError(`The outcome could not be confirmed. Refresh this order before trying again. ${errorMessage(e)}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const loadRiders = useCallback(async () => {
    setRidersLoading(true);
    setRidersError('');
    try {
      setRiders(readRiders(await api.get('/merchant/riders')).filter(assignableRider));
    } catch (e) {
      setRiders([]);
      setRidersError(errorMessage(e));
    } finally {
      setRidersLoading(false);
    }
  }, []);

  // Load assignable riders once the order is ready for pickup.
  useEffect(() => {
    if (order?.status === 'READY_FOR_PICKUP') loadRiders();
  }, [order?.status, loadRiders]);

  if (!order) return <Modal title="Order details" onClose={onClose}><div className="p-4" role={detailError ? 'alert' : undefined}>{detailError ? <>Unable to load this order. {detailError} <button type="button" className="ops-button" onClick={() => { setDetailError(''); setDetailLoading(true); loadOrder().catch((e) => setDetailError(errorMessage(e))).finally(() => setDetailLoading(false)); }}>Retry</button></> : detailLoading ? <InlineSkeleton label="Loading order details" rows={5} /> : 'Order details unavailable.'}</div></Modal>;

  const s: string = order.status;
  const items = order.items;
  const addr = order.deliveryAddress;

  return (
    <Modal title={`Order ${order.orderNumber}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={s} />
          <span className="text-slate-400">{statusLabel(s)}</span>
          <span className="ml-auto text-xs text-slate-400">{fmtTime(order.createdAt)}</span>
        </div>

        {/* Customer + delivery */}
        <div className="grid grid-cols-1 gap-1 text-slate-600 sm:grid-cols-2">
          <div>
            <b>Customer:</b> {order.customer?.user?.fullName ?? '—'}
            {order.customer?.user?.phoneNumber ? ` (${order.customer.user.phoneNumber})` : ''}
          </div>
          <div>
            <b>Rider:</b> {order.rider?.fullName ?? '—'}
            {order.rider?.phoneNumber ? ` (${order.rider.phoneNumber})` : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 text-slate-600">
          <div className="font-semibold text-slate-700">Delivery address</div>
          {addr ? (
            <div className="mt-1">
              {addr.label && <span className="text-xs font-medium text-slate-400">{addr.label} · </span>}
              {addr.fullAddress ?? '—'}
              {addr.city ? `, ${addr.city}` : ''}
              {(addr.contactName || addr.contactPhone) && (
                <div className="text-xs text-slate-400">
                  {addr.contactName ?? ''} {addr.contactPhone ? `· ${addr.contactPhone}` : ''}
                </div>
              )}
              {addr.instructions && <div className="text-xs text-slate-400">Note: {addr.instructions}</div>}
            </div>
          ) : (
            <div className="mt-1">—</div>
          )}
        </div>

        {/* Items */}
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-1 font-semibold text-slate-700">Items</div>
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 py-1">
                <span>
                  {it.quantity} × {it.productNameSnapshot}
                  {it.itemStatus && it.itemStatus !== 'CONFIRMED' && (
                    <span className="ml-1 text-xs text-slate-400">({it.itemStatus.replace(/_/g, ' ').toLowerCase()})</span>
                  )}
                </span>
                <span className="row"><span>{pkr(it.totalPricePaisa)}</span>{['SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING'].includes(s) && it.itemStatus === 'CONFIRMED' && profile && can(profile, 'ORDERS') && <button type="button" className="btn tiny" onClick={() => setUnavailableItem(it)}>Unavailable</button>}</span>
              </li>
            ))}
            {items.length === 0 && <li className="py-1 text-slate-400">No items.</li>}
          </ul>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-xs text-slate-500">
            <span>
              Subtotal {pkr(order.subtotalPaisa)} · Delivery {pkr(order.deliveryFeePaisa)}
            </span>
            <b className="text-slate-800">{pkr(order.totalAmountPaisa)}</b>
          </div>
        </div>

        {order.customerNote && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            <b>Customer note:</b> {order.customerNote}
          </div>
        )}

        {/* Timeline */}
        <details>
          <summary className="cursor-pointer text-xs text-slate-400">
            Timeline ({order.timeline?.length ?? 0})
          </summary>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
            {(order.timeline ?? []).map((t: any) => (
              <li key={t.id}>
                {new Date(t.createdAt).toLocaleTimeString()} — <b>{statusLabel(t.status)}</b>
                {t.changedByRole ? ` (${t.changedByRole})` : ''} {t.notes ?? ''}
              </li>
            ))}
            {(order.timeline?.length ?? 0) === 0 && <li>No timeline entries.</li>}
          </ul>
        </details>

        {actionError && <ToastMessage>{actionError}</ToastMessage>}
        {uncertain && <button type="button" className={btnGhost} onClick={() => loadOrder().catch((e) => setDetailError(errorMessage(e)))}>Refresh order to check outcome</button>}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          {!profile ? profileError ? <span className="text-xs text-red-700" role="alert">Unable to verify merchant permissions. {profileError} <button type="button" className={btnGhost} onClick={retryProfile}>Retry</button></span> : <span className="text-xs text-slate-500">Checking merchant permissions before showing actions.</span> : !can(profile, 'ORDERS') ? <span className="text-xs text-red-700">You do not have order-management permission.</span> : <>
            {s === 'SENT_TO_MERCHANT' && <>
              <button type="button" className={btnCls} disabled={busy || uncertain} onClick={() => act('accept', 'MERCHANT_ACCEPTED', 'Order accepted')}>Accept order</button>
              <button type="button" className={btnDanger} disabled={busy || uncertain} onClick={() => setRejecting(true)}>Reject order</button>
            </>}
            {s === 'MERCHANT_ACCEPTED' && <>
              <button type="button" className={btnCls} disabled={busy || uncertain} onClick={() => act('preparing', 'PREPARING', 'Order is preparing')}>Start preparing</button>
              <button type="button" className={btnGhost} disabled={busy || uncertain} onClick={() => act('ready', 'READY_FOR_PICKUP', 'Order ready for pickup')}>Mark ready</button>
            </>}
            {s === 'PREPARING' && <button type="button" className={btnCls} disabled={busy || uncertain} onClick={() => act('ready', 'READY_FOR_PICKUP', 'Order ready for pickup')}>Mark ready for pickup</button>}
            {s === 'READY_FOR_PICKUP' && <div className="w-full space-y-3">
              {!can(profile, 'RIDERS') ? <p className="text-xs text-red-700">Rider permission is required to assign a rider.</p> : ridersLoading ? <InlineSkeleton label="Loading your riders" rows={4} /> : ridersError ? <p role="alert" className="text-xs text-red-700">Unable to load riders. {ridersError} <button type="button" className={btnGhost} onClick={loadRiders}>Retry</button></p> : riders.length === 0 ? <p className="text-xs text-slate-600">No active, approved riders are available for this shop. Add or approve a rider in My riders.</p> : <>
                <label htmlFor="assign-rider" className="block text-xs font-semibold text-slate-700">Choose one of your active, approved riders</label>
                <select id="assign-rider" className={`${inputCls} w-full`} value={riderId} onChange={(e) => { setRiderId(e.target.value); setConfirmAssign(false); }}>
                  <option value="">Select a rider</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName} · {r.phoneNumber}</option>)}
                </select>
                {confirmAssign ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p>Assign {riders.find((r) => r.id === riderId)?.fullName} to order {order.orderNumber}?</p><div className="mt-2 flex gap-2"><button type="button" className={btnCls} disabled={busy || uncertain} onClick={() => act('assign-rider', 'RIDER_ASSIGNED', 'Rider assignment confirmed', { riderId })}>{busy ? 'Confirming…' : 'Confirm assignment'}</button><button type="button" className={btnGhost} disabled={busy} onClick={() => setConfirmAssign(false)}>Cancel</button></div></div> : <button type="button" className={btnCls} disabled={busy || uncertain || !riderId} onClick={() => setConfirmAssign(true)}>Assign selected rider</button>}
              </>}
            </div>}
            {!['SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(s) && <span className="text-xs text-slate-500">No merchant actions are available for this status.</span>}
          </>}
        </div>
        {rejecting && s === 'SENT_TO_MERCHANT' && <div className="rounded-xl border border-red-200 bg-red-50 p-3"><label htmlFor="rejection-reason" className="block text-xs font-semibold text-red-900">Reason for rejecting this order</label><textarea id="rejection-reason" className={`${inputCls} mt-2`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required /><div className="mt-2 flex gap-2"><button type="button" className={btnDanger} disabled={busy || uncertain || !reason.trim()} onClick={() => act('reject', 'MERCHANT_REJECTED', 'Order rejected', { reason: reason.trim() })}>Confirm rejection</button><button type="button" className={btnGhost} disabled={busy} onClick={() => setRejecting(false)}>Cancel</button></div></div>}
        {unavailableItem && <UnavailableItemModal orderId={orderId} item={unavailableItem} onClose={() => setUnavailableItem(null)} onSaved={async () => { setUnavailableItem(null); await loadOrder(); reload(); toast('Item availability update sent to the customer'); }} />}
      </div>
    </Modal>
  );
}

function UnavailableItemModal({ orderId, item, onClose, onSaved }: { orderId: string; item: MerchantOrder['items'][number]; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<MerchantListing[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [replacementId, setReplacementId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: '20', isAvailable: 'true', minStock: String(item.quantity) });
    if (query) params.set('q', query);
    setLoadingProducts(true);
    setError('');
    api.get(`/merchant/products?${params.toString()}`).then((value) => {
      if (!active) return;
      const result = readListingsPage(value);
      setProducts(result.items);
      setTotalPages(result.totalPages);
    }).catch((cause) => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, [page, query, item.quantity]);
  const submit = async () => {
    setBusy(true); setError('');
    try { await api.post(`/merchant/orders/${orderId}/items/${item.id}/unavailable`, replacementId ? { replacementMerchantProductId: replacementId } : {}); onSaved(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Modal title={`Unavailable: ${item.productNameSnapshot}`} onClose={onClose}>
    <div className="dialog-body space-y-3">
      <p className="small muted">Remove the unavailable item or suggest an in-stock replacement. The customer must accept a suggested replacement.</p>
      <label className="field">Search your shop listings
        <input className={inputCls} type="search" value={search} onChange={(event) => { setReplacementId(''); setSearch(event.target.value); }} placeholder="Search replacement products" />
      </label>
      <label className="field">Replacement product
        <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
          <option value="">No replacement — remove item</option>
          {products.filter((product) => product.id !== item.merchantProductId).map((product) => <option value={product.id} key={product.id}>{product.product.name} · stock {product.stockQuantity} · {pkr(product.discountPricePaisa ?? product.pricePaisa)}</option>)}
        </select>
      </label>
      {loadingProducts && <p className="small muted" role="status">Loading eligible products…</p>}
      {!loadingProducts && products.length === 0 && !error && <p className="small muted">No eligible products match this search.</p>}
      {totalPages > 1 && <nav className="catalog-pagination" aria-label="Replacement product pages"><button type="button" className="btn" disabled={page <= 1 || loadingProducts} onClick={() => { setPage(page - 1); setReplacementId(''); }}><UiIcon name="back" /> Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="btn" disabled={page >= totalPages || loadingProducts} onClick={() => { setPage(page + 1); setReplacementId(''); }}>Next <UiIcon name="arrow" /></button></nav>}
      {error && <ToastMessage>{error}</ToastMessage>}
      <div className="row"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={busy || loadingProducts} onClick={() => void submit()}>{busy ? 'Updating…' : replacementId ? 'Suggest replacement' : 'Mark unavailable'}</button></div>
    </div>
  </Modal>;
}
