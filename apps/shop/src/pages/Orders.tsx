import { ToastMessage } from '../components/Toast';
import { ReferenceIcon as UiIcon } from '../components/ReferenceIcon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  }, [page]);

  // Reload on filter change.
  useEffect(() => {
    load(true);
  }, [status, load]);

  const loadProfile = useCallback(async () => {
    setProfileError('');
    try { setProfile(await api.getParsed('/merchant/profile', readProfile)); }
    catch (e) { setProfile(null); setProfileError(errorMessage(e)); }
  }, []);
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
          key={selectedId}
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
  const actionInFlight = useRef(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [unavailableItem, setUnavailableItem] = useState<any | null>(null);
  const detailRequest = useRef(0);

  const loadOrder = useCallback(async () => {
    const request = ++detailRequest.current;
    const fresh = await api.getParsed(`/merchant/orders/${orderId}`, readOrder);
    if (request === detailRequest.current) {
      setOrder(fresh);
      setDetailError('');
      setUncertain(false);
    }
    return fresh;
  }, [orderId]);

  useEffect(() => {
    setDetailLoading(true);
    loadOrder().catch((e) => setDetailError(errorMessage(e))).finally(() => setDetailLoading(false));
    return () => { detailRequest.current++; };
  }, [loadOrder]);

  useEffect(() => {
    const refresh = () => { if (!document.hidden && !actionInFlight.current && !uncertain) void loadOrder().catch(() => undefined); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('sb:orders', refresh);
    return () => { clearInterval(timer); window.removeEventListener('sb:orders', refresh); };
  }, [loadOrder, uncertain]);

  const act = async (action: string, expectedStatus: string | string[], okMsg: string, body?: unknown) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setActionError('');
    const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const confirmed = (fresh: MerchantOrder) => expected.includes(fresh.status) &&
      (action !== 'assign-rider' || fresh.rider?.id === (body as { riderId: string }).riderId);
    try {
      const result = await api.post(`/merchant/orders/${orderId}/${action}`, body);
      if (result?.ok !== true || !expected.includes(result.status)) throw new Error('The order update was not confirmed. Refresh to check its saved status.');
      const fresh = await loadOrder();
      reload();
      if (!confirmed(fresh)) throw new Error('The order changed while this action was being confirmed.');
      toast(okMsg);
      window.dispatchEvent(new Event('sb:orders'));
      setRejecting(false);
    } catch (e) {
      try {
        const fresh = await loadOrder();
        reload();
        if (confirmed(fresh)) { toast(action === 'assign-rider' ? 'Rider assignment confirmed' : `Latest order state confirmed: ${statusLabel(fresh.status)}`); window.dispatchEvent(new Event('sb:orders')); setRejecting(false); return; }
        setActionError(`${errorMessage(e)} The latest order state is shown. Review it before trying again.`);
      } catch {
        setUncertain(true);
        setActionError(`The outcome could not be confirmed. Refresh this order before trying again. ${errorMessage(e)}`);
      }
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const loadRiders = useCallback(async () => {
    setRidersLoading(true);
    setRidersError('');
    try {
      const available = readRiders(await api.get('/merchant/riders')).filter((r) => assignableRider(r) && r.currentStatus === 'IDLE' && !r.currentOrderId);
      setRiders(available);
      setRiderId(current => available.some(r => r.id === current) ? current : '');
    } catch (e) {
      setRiders([]);
      setRidersError(errorMessage(e));
    } finally {
      setRidersLoading(false);
    }
  }, []);

  // Delivery planning is available during preparation, in the same sidebar.
  useEffect(() => {
    if (profile && can(profile, 'RIDERS') && !order?.rider && ['MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order?.status ?? '')) void loadRiders();
  }, [order?.status, order?.rider?.id, profile, loadRiders]);

  if (!order) return <Modal title="Order details" onClose={onClose}><div className="p-4" role={detailError ? 'alert' : undefined}>{detailError ? <>Unable to load this order. {detailError} <button type="button" className="ops-button" onClick={() => { setDetailError(''); setDetailLoading(true); loadOrder().catch((e) => setDetailError(errorMessage(e))).finally(() => setDetailLoading(false)); }}>Retry</button></> : detailLoading ? <InlineSkeleton label="Loading order details" rows={5} /> : 'Order details unavailable.'}</div></Modal>;

  const s: string = order.status;
  const items = order.items;
  const addr = order.deliveryAddress;

  return (
    <Modal title={`Order ${order.orderNumber}`} onClose={onClose}>
      <div className="order-details space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={s} />
          <span className="text-slate-400">{statusLabel(s)}</span>
          <span className="ml-auto text-xs text-slate-400">{fmtTime(order.createdAt)}</span>
        </div>

        {/* Customer + delivery */}
        <section className="order-workflow" aria-labelledby="order-next-step">
          <h3 id="order-next-step">Next step</h3>
          {!profile ? profileError ? <><ToastMessage>Unable to check your permissions. Retry before updating this order.</ToastMessage><button type="button" className={btnGhost} onClick={retryProfile}>Retry permission check</button></> : <p role="status">Checking your shop permissions…</p> : !can(profile, 'ORDERS') ? <p>You need order-management permission to update this order. Ask the shop owner.</p> : <>
            {s === 'SENT_TO_MERCHANT' && <>
              <p>Accept to start preparing. The buyer will see the update immediately after it is saved.</p>
              <div className="order-workflow-actions">
                <button type="button" className={btnCls} disabled={busy || uncertain} onClick={() => void act('accept', 'PREPARING', 'Order accepted. Preparation started.')}>{busy ? 'Accepting…' : 'Accept order'}</button>
                <button type="button" className={btnDanger} disabled={busy || uncertain} onClick={() => setRejecting(true)}>Reject order</button>
              </div>
            </>}
            {['MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(s) && <>
              <p>{s === 'READY_FOR_PICKUP' ? 'The order is packed. Assign a rider for pickup.' : 'Prepare and pack the items. You can assign a rider now; pickup stays blocked until you mark the order ready.'}</p>
              {order.rider ? <div className="order-rider-card"><ReferenceIcon name="rider" /><div><strong>{order.rider.fullName}</strong><p>Assigned rider{s === 'PREPARING' || s === 'MERCHANT_ACCEPTED' ? ' · waiting for packing' : ''}</p>{order.rider.phoneNumber && <a href={`tel:${order.rider.phoneNumber}`}>Call {order.rider.phoneNumber}</a>}</div></div> : !can(profile, 'RIDERS') ? <p>Ask the shop owner to assign a rider. Rider-management permission is required.</p> : ridersLoading ? <InlineSkeleton label="Loading available riders" rows={2} /> : ridersError ? <><ToastMessage>Unable to load riders. Check your connection and retry.</ToastMessage><button type="button" className={btnGhost} onClick={() => void loadRiders()}>Retry riders</button></> : riders.length === 0 ? <div className="order-rider-empty"><strong>No riders available</strong><p>Add or approve a rider, or wait for a current delivery to finish.</p><div className="order-workflow-actions"><Link className={btnGhost} to="/riders">Manage riders</Link><button type="button" className={btnGhost} onClick={() => void loadRiders()}>Refresh riders</button></div></div> : <>
                <label className="field" htmlFor="assign-rider">Delivery rider
                  <select id="assign-rider" className={inputCls} value={riderId} disabled={busy || uncertain} onChange={(e) => setRiderId(e.target.value)}>
                    <option value="">Choose an available rider</option>
                    {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName} · {r.phoneNumber}{r.isOnline ? ' · Online' : ' · Offline'}</option>)}
                  </select>
                </label>
                <button type="button" className={btnCls} disabled={busy || uncertain || !riderId} onClick={() => void act('assign-rider', ['MERCHANT_ACCEPTED', 'PREPARING', 'RIDER_ASSIGNED'], 'Rider assigned', { riderId })}>{busy ? 'Assigning…' : 'Assign rider'}</button>
              </>}
              {s === 'MERCHANT_ACCEPTED' && <button type="button" className={btnGhost} disabled={busy || uncertain} onClick={() => void act('preparing', 'PREPARING', 'Preparation started')}>Start preparing</button>}
              {['MERCHANT_ACCEPTED', 'PREPARING'].includes(s) && <button type="button" className={order.rider ? btnCls : btnGhost} disabled={busy || uncertain} onClick={() => void act('ready', ['READY_FOR_PICKUP', 'RIDER_ASSIGNED'], 'Order ready for pickup')}>{busy ? 'Updating…' : 'Mark ready for pickup'}</button>}
            </>}
            {s === 'RIDER_ASSIGNED' && <p>The order is ready. {order.rider?.fullName ?? 'The assigned rider'} can confirm pickup in the rider app.</p>}
            {!['SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED'].includes(s) && <p>No shop action is needed now. Delivery updates will appear in this order.</p>}
          </>}
          {actionError && <ToastMessage>{actionError}</ToastMessage>}
          {uncertain && <button type="button" className={btnGhost} disabled={busy} onClick={() => loadOrder().catch((e) => setActionError(errorMessage(e)))}>Check saved order</button>}
        </section>

        {/* Customer + delivery details */}
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

        {rejecting && s === 'SENT_TO_MERCHANT' && <div className="rounded-xl border border-red-200 bg-red-50 p-3"><label htmlFor="rejection-reason" className="block text-xs font-semibold text-red-900">Reason for rejecting this order</label><textarea id="rejection-reason" className={`${inputCls} mt-2`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required /><div className="mt-2 flex gap-2"><button type="button" className={btnDanger} disabled={busy || uncertain || !reason.trim()} onClick={() => act('reject', 'MERCHANT_REJECTED', 'Order rejected', { reason: reason.trim() })}>Confirm rejection</button><button type="button" className={btnGhost} disabled={busy} onClick={() => setRejecting(false)}>Cancel</button></div></div>}
        {unavailableItem && <UnavailableItemModal orderId={orderId} item={unavailableItem} onClose={() => setUnavailableItem(null)} onSaved={async () => { setUnavailableItem(null); await loadOrder(); reload(); toast('Item availability update sent to the customer'); }} />}
      </div>
    </Modal>
  );
}

function UnavailableItemModal({ orderId, item, onClose, onSaved }: { orderId: string; item: MerchantOrder['items'][number]; onClose: () => void; onSaved: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [products, setProducts] = useState<MerchantListing[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [action, setAction] = useState<'REMOVE' | 'REDUCE' | 'REPLACE'>('REMOVE');
  const [proposedQuantity, setProposedQuantity] = useState(String(Math.max(1, item.quantity - 1)));
  const [replacementId, setReplacementId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    if (action !== 'REPLACE') { setProducts([]); setLoadingProducts(false); setError(''); return () => { active = false; }; }
    const params = new URLSearchParams({ page: String(page), pageSize: '20', isAvailable: 'true', minStock: '1' });
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
  }, [page, query, action]);
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const quantity = Number(proposedQuantity);
      if (action === 'REDUCE' && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity >= item.quantity)) throw Error('Choose a positive quantity below the confirmed quantity.');
      if (action === 'REPLACE' && (!replacementId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.quantity)) throw Error('Choose an in-stock replacement and valid quantity.');
      const change = action === 'REMOVE' ? { originalItemId: item.id, action } : action === 'REDUCE'
        ? { originalItemId: item.id, action, quantity }
        : { originalItemId: item.id, action, quantity, replacementMerchantProductId: replacementId };
      await api.post(`/merchant/orders/${orderId}/revisions`, { requestId, changes: [change] });
      onSaved();
    }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Modal title={`Unavailable: ${item.productNameSnapshot}`} onClose={onClose}>
    <div className="dialog-body space-y-3">
      <p className="small muted">The original order remains unchanged until the customer approves. Proposals expire after 30 minutes.</p>
      <label className="field">Proposed change
        <select value={action} onChange={(event) => { setAction(event.target.value as typeof action); setReplacementId(''); }}>
          <option value="REMOVE">Remove unavailable item</option>
          {item.quantity > 1 && <option value="REDUCE">Reduce quantity</option>}
          <option value="REPLACE">Suggest a replacement</option>
        </select>
      </label>
      {action !== 'REMOVE' && <label className="field">Proposed quantity
        <input className={inputCls} type="number" min="1" max={item.quantity} step="1" value={proposedQuantity} onChange={(event) => setProposedQuantity(event.target.value)} />
      </label>}
      {action === 'REPLACE' && <>
        <label className="field">Search your shop listings
          <input className={inputCls} type="search" value={search} onChange={(event) => { setReplacementId(''); setSearch(event.target.value); }} placeholder="Search replacement products" />
        </label>
        <label className="field">Replacement product
          <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
            <option value="">Choose an in-stock product</option>
            {products.filter((product) => product.id !== item.merchantProductId && product.stockQuantity >= Number(proposedQuantity)).map((product) => <option value={product.id} key={product.id}>{product.product.name} · stock {product.stockQuantity} · {pkr(product.discountPricePaisa ?? product.pricePaisa)}</option>)}
          </select>
        </label>
      </>}
      {loadingProducts && <p className="small muted" role="status">Loading eligible products…</p>}
      {!loadingProducts && products.length === 0 && !error && <p className="small muted">No eligible products match this search.</p>}
      {action === 'REPLACE' && totalPages > 1 && <nav className="catalog-pagination" aria-label="Replacement product pages"><button type="button" className="btn" disabled={page <= 1 || loadingProducts} onClick={() => { setPage(page - 1); setReplacementId(''); }}><UiIcon name="back" /> Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="btn" disabled={page >= totalPages || loadingProducts} onClick={() => { setPage(page + 1); setReplacementId(''); }}>Next <UiIcon name="arrow" /></button></nav>}
      {error && <ToastMessage>{error}</ToastMessage>}
      <div className="row"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={busy || loadingProducts || (action === 'REPLACE' && !replacementId)} onClick={() => void submit()}>{busy ? 'Sending proposal…' : 'Request customer approval'}</button></div>
    </div>
  </Modal>;
}
