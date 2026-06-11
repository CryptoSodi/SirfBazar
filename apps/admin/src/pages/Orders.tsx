import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Table, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

const STATUSES = ['', 'SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'MERCHANT_REJECTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_ADMIN', 'PAYMENT_PENDING'];

export default function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/orders', { status, q });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast, node } = useToast();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Orders</h1>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
        <input className={`${inputCls} max-w-xs`} placeholder="Order number…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Order', 'Customer', 'Shop', 'Rider', 'Total', 'Payment', 'Status', '']}>
        {items.map((o) => (
          <tr key={o.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-mono text-xs">{o.orderNumber}<div className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleString()}</div></td>
            <td className="px-4 py-2.5">{o.customer?.user?.fullName ?? '—'}<div className="text-xs text-slate-400">{o.customer?.user?.phoneNumber}</div></td>
            <td className="px-4 py-2.5">{o.merchant?.shopName ?? '—'}</td>
            <td className="px-4 py-2.5">{o.rider?.fullName ?? '—'}</td>
            <td className="px-4 py-2.5 font-semibold">{pkr(o.totalAmountPaisa)}</td>
            <td className="px-4 py-2.5"><Badge value={o.paymentStatus} /><div className="mt-0.5 text-[10px] text-slate-400">{o.paymentMethod}</div></td>
            <td className="px-4 py-2.5"><Badge value={o.status} /></td>
            <td className="px-4 py-2.5 text-right"><button className={btnGhost} onClick={() => setSelectedId(o.id)}>Open</button></td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No orders found.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {selectedId && <OrderModal orderId={selectedId} onClose={() => setSelectedId(null)} toast={toast} reload={reload} />}
      {node}
    </div>
  );
}

function OrderModal({ orderId, onClose, toast, reload }: any) {
  const [order, setOrder] = useState<any>(null);

  const load = () => api.get(`/admin/orders/${orderId}`).then(setOrder).catch((e) => toast(e.message, false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  if (!order) return null;

  const act = async (fn: () => Promise<any>) => {
    try {
      await fn();
      toast('Done');
      await load();
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

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

        <div className="flex flex-wrap gap-2">
          <button className={btnDanger} onClick={() => { const reason = prompt('Cancellation reason:'); if (reason) act(() => api.post(`/admin/orders/${orderId}/cancel`, { reason })); }}>
            Cancel order
          </button>
          <button className={btnGhost} onClick={() => { const amount = prompt('Refund amount in Rs (blank = full):'); const reason = prompt('Refund reason:') || 'Admin refund'; act(() => api.post(`/admin/orders/${orderId}/refund`, { amountPaisa: amount ? Math.round(Number(amount) * 100) : undefined, reason })); }}>
            Issue refund
          </button>
          <button className={btnGhost} onClick={() => { const status = prompt('New status (e.g. DELIVERED, FAILED_DELIVERY):'); const reason = prompt('Override reason:') || ''; if (status) act(() => api.post(`/admin/orders/${orderId}/status`, { status: status.toUpperCase(), reason })); }}>
            Override status
          </button>
        </div>
      </div>
    </Modal>
  );
}
