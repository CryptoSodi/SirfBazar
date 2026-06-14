import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Stat, Table, useToast } from '../components/ui';

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '—');

export default function Earnings() {
  const { toast, node } = useToast();
  const [earnings, setEarnings] = useState<any | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const { items, page, setPage, totalPages, loading, error } = usePaged('/merchant/settlements', {});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingEarnings(true);
      try {
        const res = await api.get('/merchant/earnings');
        if (alive) setEarnings(res);
      } catch (e: any) {
        if (alive) toast(e.message, false);
      } finally {
        if (alive) setLoadingEarnings(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold">Earnings</h1>
      <p className="mt-1 text-sm text-slate-500">Delivered-order breakdown for the last 30 days.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Gross sales" value={pkr(earnings?.grossSalesPaisa)} hint="Subtotal of delivered orders" />
        <Stat label="Commission" value={pkr(earnings?.commissionPaisa)} hint="Platform fee" />
        <Stat label="Refund deductions" value={pkr(earnings?.refundDeductionsPaisa)} hint="Completed refunds" />
        <Stat label="Net payable" value={pkr(earnings?.netPayablePaisa)} hint="Earnings − refunds" />
        <Stat label="Delivered orders" value={earnings?.deliveredOrders ?? (loadingEarnings ? '…' : 0)} />
      </div>

      <h2 className="mt-8 text-lg font-bold">Settlements</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3">
        <Table headers={['Period', 'Amount', 'Status', 'Paid at', 'Reference', 'Created']}>
          {items.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-xs">
                {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
              </td>
              <td className="px-4 py-2.5 font-semibold">{pkr(s.amountPaisa)}</td>
              <td className="px-4 py-2.5">
                <Badge value={s.status} />
              </td>
              <td className="px-4 py-2.5 text-xs">{fmtDateTime(s.paidAt)}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{s.paymentReference ?? '—'}</td>
              <td className="px-4 py-2.5 text-xs">{fmtDate(s.createdAt)}</td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No settlements yet.
              </td>
            </tr>
          )}
        </Table>
        <Pager page={page} totalPages={totalPages} setPage={setPage} />
      </div>
      {node}
    </div>
  );
}
