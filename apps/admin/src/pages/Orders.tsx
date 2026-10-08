import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Table, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

const STATUSES = ['', 'SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'MERCHANT_REJECTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_ADMIN', 'PAYMENT_PENDING'];

export default function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { items, total, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/orders', { status, q });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast, node } = useToast();

  return (
    <div className="ops-page">
      <div><div className="ops-kicker">Marketplace / orders</div><h1 className="ops-title mt-2">All marketplace orders</h1><p className="ops-description">Inspect the end-to-end journey across merchants. {total} matching records.</p></div>
      <div className="ops-panel flex flex-wrap items-end gap-3">
        <label className="text-xs" style={{ color: 'var(--sb-secondary)' }}>Status
        <select className={`${inputCls} mt-1 w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--sb-secondary)' }}>Search order number
          <input className={`${inputCls} mt-1 max-w-xs`} placeholder="SB-1041" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {(status || q) && <button type="button" className="ops-button" onClick={() => { setStatus(''); setQ(''); }}>Clear filters</button>}
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--sb-danger)' }} role="alert">Unable to load orders. {error} <button type="button" className="ops-button" onClick={reload}>Retry</button></p>}
      {items.length === 0 ? <div className="ops-panel ops-empty" role={loading ? 'status' : undefined}>{loading ? 'Loading orders…' : 'No orders match these filters. Clear filters to see all orders.'}</div> : <Table headers={['Order', 'Customer', 'Shop', 'Rider', 'Total', 'Payment', 'Status', '']}>
        {items.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-mono text-xs">{o.orderNumber}<div className="mt-1 text-xs" style={{ color: 'var(--sb-secondary)' }}>{new Date(o.createdAt).toLocaleString()}</div></td>
            <td className="px-4 py-2.5">{o.customer?.user?.fullName ?? '—'}<div className="text-xs text-slate-400">{o.customer?.user?.phoneNumber}</div></td>
            <td className="px-4 py-2.5">{o.merchant?.shopName ?? '—'}</td>
            <td className="px-4 py-2.5">{o.rider?.fullName ?? '—'}</td>
            <td className="px-4 py-2.5 font-semibold">{pkr(o.totalAmountPaisa)}</td>
            <td className="px-4 py-2.5"><Badge value={o.paymentStatus} /><div className="mt-0.5 text-[10px] text-slate-400">{o.paymentMethod}</div></td>
            <td className="px-4 py-2.5"><Badge value={o.status} /></td>
            <td className="px-4 py-2.5 text-right"><button type="button" className="ops-button" onClick={() => setSelectedId(o.id)} aria-label={`View order ${o.orderNumber}`}>View</button></td>
          </tr>
        ))}
      </Table>
      }
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {selectedId && <OrderModal orderId={selectedId} onClose={() => setSelectedId(null)} toast={toast} reload={reload} />}
      {node}
    </div>
  );
}

function OrderModal({ orderId, onClose, toast, reload }: any) {
  const [order, setOrder] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [repairStatus, setRepairStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [returnReview, setReturnReview] = useState<any[] | null>(null);

  const load = () => api.get(`/admin/orders/${orderId}`).then(setOrder).catch((e) => toast(e.message, false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  if (!order) return null;

  const act = async (fn: () => Promise<any>, success = 'Done') => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fn();
      if (response?.returnReviewRequired) setReturnReview(response.returnReview ?? []);
      toast(success);
      setRepairStatus('');
      await load();
      reload();
    } catch (e: any) {
      toast(e.message, false);
    } finally { setBusy(false); }
  };

  const forward: Record<string, string[]> = {
    SENT_TO_MERCHANT: ['MERCHANT_ACCEPTED'],
    MERCHANT_ACCEPTED: ['PREPARING', 'READY_FOR_PICKUP'],
    PREPARING: ['READY_FOR_PICKUP'],
  };
  const repairOptions = order.channel === 'ONLINE' && !order.isParent && !order.riderId && !order.pickedUpAt &&
    order.paymentMethod === 'COD' && order.paymentStatus === 'CASH_PENDING' &&
    !(order.items ?? []).some((item: any) => item.itemStatus === 'REPLACEMENT_SUGGESTED')
      ? forward[order.status] ?? [] : [];

  return (
    <Modal title={`Order ${order.orderNumber}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={order.status} />
          <Badge value={order.paymentStatus} />
          <span className="text-slate-400">{order.paymentMethod}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-slate-600">
          <div><b>Customer:</b> {order.customer?.user?.fullName} ({order.customer?.user?.phoneNumber})</div>
          <div><b>Shop:</b> {order.merchant?.shopName ?? '— (parent order)'}</div>
          <div><b>Rider:</b> {order.rider?.fullName ?? '—'}</div>
          <div><b>Address:</b> {order.deliveryAddress?.fullAddress ?? '—'}</div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-1 font-semibold">Items</div>
          <ul className="divide-y divide-slate-100">
            {(order.isParent ? order.children.flatMap((c: any) => c.items) : order.items).map((it: any) => (
              <li key={it.id} className="flex justify-between py-1">
                <span>{it.quantity} × {it.productNameSnapshot} <span className="text-xs text-slate-400">({it.itemStatus})</span></span>
                <span>{pkr(it.totalPricePaisa)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-xs text-slate-500">
            <span>Subtotal {pkr(order.subtotalPaisa)} · Delivery {pkr(order.deliveryFeePaisa)} · Fees {pkr(order.serviceFeePaisa + order.smallOrderFeePaisa)} · Commission {pkr(order.commissionAmountPaisa)}</span>
            <b className="text-slate-800">{pkr(order.totalAmountPaisa)}</b>
          </div>
        </div>

        <details>
          <summary className="cursor-pointer text-xs text-slate-400">Timeline ({order.timeline?.length ?? 0})</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
            {(order.timeline ?? []).map((t: any) => (
              <li key={t.id}>{new Date(t.createdAt).toLocaleTimeString()} — <b>{t.status}</b> {t.changedByRole && `(${t.changedByRole})`} {t.notes}</li>
            ))}
          </ul>
        </details>

        {returnReview && <section className="rounded-xl border border-amber-500 p-3" role="status"><h3 className="font-semibold">Return review required</h3><p>This cancellation happened after pickup. Review returned goods and stock manually; no automatic restock was made.</p>{returnReview.map((entry: any) => <p key={entry.orderId}>Order {entry.orderId}: {entry.items?.length ?? 0} product lines to review.</p>)}</section>}

        <label className="block text-sm font-medium">Reason for cancellation or status repair
          <textarea className={`${inputCls} mt-1 w-full`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Describe the verified reason (up to 500 characters)" />
        </label>
        <p className="text-xs text-slate-500">{reason.trim().length}/500 characters. The API checks current payment, rider and pickup evidence again when saving.</p>

        <div className="flex flex-wrap gap-2">
          <button className={btnDanger} disabled={busy || !reason.trim()} onClick={() => void act(() => api.post(`/admin/orders/${orderId}/cancel`, { reason: reason.trim() }), 'Order cancelled. Review stock disposition below if required.')}>
            Cancel order
          </button>
          <button className={btnGhost} disabled={busy} onClick={() => { const amount = prompt('Refund amount in Rs (blank = full):'); const refundReason = prompt('Refund reason:') || 'Admin refund'; void act(() => api.post(`/admin/orders/${orderId}/refund`, { amountPaisa: amount ? Math.round(Number(amount) * 100) : undefined, reason: refundReason }), 'Refund request recorded.'); }}>
            Issue refund
          </button>
        </div>
        {repairOptions.length > 0 && <div className="rounded-xl border border-slate-200 p-3"><label className="block font-medium">Forward status repair
          <select className={`${inputCls} mt-1 w-full`} value={repairStatus} onChange={(event) => setRepairStatus(event.target.value)}><option value="">Choose a valid next status</option>{repairOptions.map((option) => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}</select>
        </label><p className="my-2 text-xs text-slate-500">Available only before rider assignment and pickup for a cash-on-delivery order. The server rechecks all prerequisites.</p><button className={btnGhost} disabled={busy || !repairOptions.includes(repairStatus) || !reason.trim()} onClick={() => void act(() => api.post(`/admin/orders/${orderId}/status`, { status: repairStatus, reason: reason.trim() }), 'Order status repaired and audited.')}>Save status repair</button></div>}
      </div>
    </Modal>
  );
}
