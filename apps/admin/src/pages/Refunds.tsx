import { useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

export default function Refunds() {
  const [status, setStatus] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/refunds', { status });
  const { toast, node } = useToast();

  const act = async (id: string, action: string, body?: any) => {
    try {
      await api.post(`/admin/refunds/${id}/${action}`, body ?? {});
      toast(`Refund ${action}ed`);
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Refunds</h1>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {['', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED'].map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Order', 'Customer', 'Shop', 'Amount', 'Reason', 'Status', '']}>
        {items.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-mono text-xs">{r.order?.orderNumber}</td>
            <td className="px-4 py-2.5">{r.customer?.user?.fullName ?? r.customer?.user?.phoneNumber}</td>
            <td className="px-4 py-2.5">{r.order?.merchant?.shopName ?? '—'}</td>
            <td className="px-4 py-2.5 font-semibold">{pkr(r.amountPaisa)}</td>
            <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-500" title={r.reason}>{r.reason}</td>
            <td className="px-4 py-2.5"><Badge value={r.status} /></td>
            <td className="space-x-1 px-4 py-2.5 text-right">
              {['REQUESTED', 'UNDER_REVIEW'].includes(r.status) && (
                <>
                  <button className={btnCls} onClick={() => act(r.id, 'approve')}>Approve</button>
                  <button className={btnDanger} onClick={() => { const notes = prompt('Rejection notes:'); if (notes !== null) act(r.id, 'reject', { notes }); }}>Reject</button>
                </>
              )}
              {r.status === 'APPROVED' && <button className={btnGhost} onClick={() => act(r.id, 'process')}>💸 Pay out</button>}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No refunds.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {node}
    </div>
  );
}
