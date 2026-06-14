import { useCallback, useEffect, useRef, useState } from 'react';
import { api, pkr, statusLabel } from '../lib/api';
import { Badge, Modal, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

const CHIPS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'New', value: 'SENT_TO_MERCHANT' },
  { label: 'Accepted', value: 'MERCHANT_ACCEPTED' },
  { label: 'Preparing', value: 'PREPARING' },
  { label: 'Ready', value: 'READY_FOR_PICKUP' },
  { label: 'On the way', value: 'ON_THE_WAY' },
  { label: 'Delivered', value: 'DELIVERED' },
];

const fmtTime = (d?: string) => (d ? new Date(d).toLocaleString() : '—');
const itemCount = (o: any) =>
  (o.items ?? []).reduce((n: number, it: any) => n + (it.quantity ?? 0), 0);

export default function Orders() {
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast, node } = useToast();

  const statusRef = useRef(status);
  statusRef.current = status;

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const s = statusRef.current;
      const res = await api.get(`/merchant/orders${s ? `?status=${s}` : ''}`);
      // Guard against a stale response if the filter changed mid-flight.
      if (statusRef.current !== s) return;
      setOrders(Array.isArray(res) ? res : (res?.items ?? []));
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Reload on filter change.
  useEffect(() => {
    load(true);
  }, [status, load]);

  // Poll the list every 10s (silent refresh).
  useEffect(() => {
    const id = setInterval(() => load(false), 10000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold">Orders</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => setStatus(c.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              status === c.value
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <Table headers={['Order', 'Customer', 'Items', 'Total', 'Status', 'Time']}>
          {orders.map((o) => (
            <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(o.id)}>
              <td className="px-4 py-2.5 font-mono text-xs font-semibold">{o.orderNumber}</td>
              <td className="px-4 py-2.5">
                {o.customer?.user?.fullName ?? '—'}
                <div className="text-xs text-slate-400">{o.customer?.user?.phoneNumber ?? ''}</div>
              </td>
              <td className="px-4 py-2.5">{itemCount(o)}</td>
              <td className="px-4 py-2.5 font-semibold">{pkr(o.totalAmountPaisa)}</td>
              <td className="px-4 py-2.5"><Badge value={o.status} /></td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{fmtTime(o.createdAt)}</td>
            </tr>
          ))}
          {!loading && orders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No orders here.
              </td>
            </tr>
          )}
          {loading && orders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                Loading…
              </td>
            </tr>
          )}
        </Table>
      </div>

      {selectedId && (
        <OrderModal
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
          toast={toast}
          reload={() => load(false)}
        />
      )}
      {node}
    </div>
  );
}

function OrderModal({
  orderId,
  onClose,
  toast,
  reload,
}: {
  orderId: string;
  onClose: () => void;
  toast: (text: string, ok?: boolean) => void;
  reload: () => void;
}) {
  const [order, setOrder] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [riders, setRiders] = useState<any[]>([]);
  const [riderId, setRiderId] = useState('');

  const loadOrder = useCallback(() => {
    return api
      .get(`/merchant/orders/${orderId}`)
      .then(setOrder)
      .catch((e: any) => toast(e.message, false));
  }, [orderId, toast]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(okMsg);
      await loadOrder();
      reload();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  const loadRiders = async () => {
    try {
      const res = await api.get('/merchant/riders');
      const list = (Array.isArray(res) ? res : (res?.items ?? [])).filter(
        (r: any) => r.isActive && r.approvalStatus === 'APPROVED',
      );
      setRiders(list);
      if (!riderId && list[0]) setRiderId(list[0].id);
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  // Load assignable riders once the order is ready for pickup.
  useEffect(() => {
    if (order?.status === 'READY_FOR_PICKUP') loadRiders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  if (!order) return null;

  const s: string = order.status;
  const items: any[] = order.items ?? [];
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
              <li key={it.id} className="flex justify-between py-1">
                <span>
                  {it.quantity} × {it.productNameSnapshot}
                  {it.itemStatus && it.itemStatus !== 'CONFIRMED' && (
                    <span className="ml-1 text-xs text-slate-400">({it.itemStatus.replace(/_/g, ' ').toLowerCase()})</span>
                  )}
                </span>
                <span>{pkr(it.totalPricePaisa)}</span>
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

        {/* Lifecycle actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          {s === 'SENT_TO_MERCHANT' && (
            <>
              <button
                className={btnCls}
                disabled={busy}
                onClick={() => act(() => api.post(`/merchant/orders/${orderId}/accept`), 'Order accepted')}
              >
                Accept
              </button>
              <button
                className={btnDanger}
                disabled={busy}
                onClick={() => {
                  const reason = prompt('Reason for rejecting this order:');
                  if (reason != null) act(() => api.post(`/merchant/orders/${orderId}/reject`, { reason }), 'Order rejected');
                }}
              >
                Reject
              </button>
            </>
          )}

          {s === 'MERCHANT_ACCEPTED' && (
            <>
              <button
                className={btnCls}
                disabled={busy}
                onClick={() => act(() => api.post(`/merchant/orders/${orderId}/preparing`), 'Marked as preparing')}
              >
                Start preparing
              </button>
              <button
                className={btnGhost}
                disabled={busy}
                onClick={() => act(() => api.post(`/merchant/orders/${orderId}/ready`), 'Marked ready for pickup')}
              >
                Mark ready
              </button>
            </>
          )}

          {s === 'PREPARING' && (
            <button
              className={btnCls}
              disabled={busy}
              onClick={() => act(() => api.post(`/merchant/orders/${orderId}/ready`), 'Marked ready for pickup')}
            >
              Mark ready for pickup
            </button>
          )}

          {s === 'READY_FOR_PICKUP' && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <select
                className={`${inputCls} w-auto flex-1`}
                value={riderId}
                onChange={(e) => setRiderId(e.target.value)}
              >
                {riders.length === 0 && <option value="">No active riders</option>}
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} {r.phoneNumber ? `· ${r.phoneNumber}` : ''}
                  </option>
                ))}
              </select>
              <button
                className={btnCls}
                disabled={busy || !riderId}
                onClick={() => act(() => api.post(`/merchant/orders/${orderId}/assign-rider`, { riderId }), 'Rider assigned')}
              >
                Assign rider
              </button>
            </div>
          )}

          {!['SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(s) && (
            <span className="text-xs text-slate-400">No actions available for this status.</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
