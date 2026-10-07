import { ReferenceIcon as UiIcon } from '../components/ReferenceIcon';
import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Stat, Table, useToast } from '../components/ui';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { PageSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '—');

export default function Earnings() {
  const { toast, node } = useToast();
  const initialEarnings = readMemory<any>('earnings');
  const [earnings, setEarnings] = useState<any | null>(initialEarnings ?? null);
  const [loadingEarnings, setLoadingEarnings] = useState(!initialEarnings);
  const [earningsError, setEarningsError] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const { items, page, setPage, totalPages, loading, error } = usePaged('/merchant/settlements', {});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingEarnings(!readMemory('earnings'));
      try {
        const res = await api.get('/merchant/earnings');
        if (alive) { setEarnings(res); writeMemory('earnings', res); setEarningsError(''); }
      } catch (e: any) {
        if (alive) { setEarningsError(e.message); toast(e.message, false); }
      } finally {
        if (alive) setLoadingEarnings(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bars = Array.isArray(earnings?.byDay) ? earnings.byDay.slice(-7) : [];
  const maxBar = Math.max(1, ...bars.map((day: any) => Number(day.salesPaisa) || 0));

  if ((loadingEarnings || loading) && !earnings && items.length === 0) return <PageSkeleton label="Loading finance" />;
  if (!earnings) return <div className="panel error-state" role="alert"><div><h2>We couldn’t load your finance summary</h2><p>{earningsError || 'The earnings response is unavailable.'}</p><button className="btn primary" type="button" onClick={() => window.location.reload()}>Retry</button></div></div>;

  return (
    <div>
      <section className="page-heading"><div><div className="kicker">Payouts &amp; performance</div><h1>Finance</h1><p>Understand delivered-order value, deductions and recorded settlements.</p></div><div className="heading-actions"><div className="segmented" aria-label="Earnings period"><button type="button" className="active" aria-pressed="true">Last 30 days</button></div></div></section>

      <div className="metrics">
        <div className="metric"><span className="metric-icon"><ReferenceIcon name="finance" /></span><div className="label">Gross sales</div><div className="value num">{pkr(earnings?.grossSalesPaisa)}</div><div className="sub">Delivered orders · last 30 days</div></div>
        <div className="metric"><span className="metric-icon"><ReferenceIcon name="receipt" /></span><div className="label">Commission</div><div className="value num">{pkr(earnings?.commissionPaisa)}</div><div className="sub">Platform fee</div></div>
        <div className="metric"><span className="metric-icon"><ReferenceIcon name="back" /></span><div className="label">Refund deductions</div><div className="value num">{pkr(earnings?.refundDeductionsPaisa)}</div><div className="sub">Completed refunds</div></div>
        <div className="metric featured"><span className="metric-icon"><ReferenceIcon name="checkCircle" /></span><div className="label">Net payable</div><div className="value num">{pkr(earnings?.netPayablePaisa)}</div><div className="sub">{loadingEarnings ? 'Loading…' : `${earnings?.deliveredOrders ?? 0} delivered orders`}</div></div>
      </div>

      <div className="columns bottom"><section className="panel"><div className="panel-head"><div><h2>Merchandise by day</h2><p>Delivered online orders · selected period</p></div></div><div className="chart-section"><div className="chart-heading"><b>{pkr(earnings?.grossSalesPaisa)}</b><small>Merchandise subtotal · last 30 days</small></div>{bars.length ? <svg className="chart" viewBox="0 0 700 160" role="img" aria-label="Delivered merchandise by day">{bars.map((day: any, index: number) => { const height = Math.max(3, ((Number(day.salesPaisa) || 0) / maxBar) * 100); const x = 65 + index * 88; return <g key={day.date}><rect className={`bar ${index === bars.length - 1 ? 'last' : ''}`} x={x} y={120 - height} width="48" height={height} rx="3" /><text x={x + 24} y="145" textAnchor="middle">{String(day.date).slice(5)}</text></g>; })}</svg> : <div className="empty"><span className="empty-icon"><ReferenceIcon name="finance" /></span><h2>No delivered orders yet</h2><p>The API returned no daily delivery records for this period.</p></div>}</div></section><section className="panel"><div className="panel-head"><div><h2>How this is calculated</h2><p>Based on the authorized earnings response.</p></div></div><div className="panel-pad"><div className="definition"><span>Gross sales</span><b>{pkr(earnings?.grossSalesPaisa)}</b></div><div className="definition"><span>Commission</span><b>{pkr(earnings?.commissionPaisa)}</b></div><div className="definition"><span>Refund deductions</span><b>{pkr(earnings?.refundDeductionsPaisa)}</b></div><div className="definition"><span>Net payable</span><b>{pkr(earnings?.netPayablePaisa)}</b></div></div></section></div>

      <div hidden className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Gross sales" value={pkr(earnings?.grossSalesPaisa)} hint="Subtotal of delivered orders" />
        <Stat label="Commission" value={pkr(earnings?.commissionPaisa)} hint="Platform fee" />
        <Stat label="Refund deductions" value={pkr(earnings?.refundDeductionsPaisa)} hint="Completed refunds" />
        <Stat label="Net payable" value={pkr(earnings?.netPayablePaisa)} hint="Earnings − refunds" />
        <Stat label="Delivered orders" value={earnings?.deliveredOrders ?? (loadingEarnings ? '…' : 0)} />
      </div>

      <section className="panel" style={{ marginTop: 20 }}><div className="panel-head"><div><h2>Settlement history</h2><p>Recorded payouts for your shop.</p></div></div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3">
        <Table headers={['Period', 'Amount', 'Status', 'Paid at', 'Reference', 'Created', '']}>
          {items.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2.5 text-xs">
                {fmtDate(s.startDate)} <UiIcon name="arrow" /> {fmtDate(s.endDate)}
              </td>
              <td className="px-4 py-2.5 font-semibold">{pkr(s.amountPaisa)}</td>
              <td className="px-4 py-2.5">
                <Badge value={s.status} />
              </td>
              <td className="px-4 py-2.5 text-xs">{fmtDateTime(s.paidAt)}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{s.paymentReference ?? '—'}</td>
              <td className="px-4 py-2.5 text-xs">{fmtDate(s.createdAt)}</td>
              <td><button type="button" className="btn tiny" onClick={() => setSelected(s)}>Details <ReferenceIcon name="right" size="sm" /></button></td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                No settlements yet.
              </td>
            </tr>
          )}
        </Table>
        <Pager page={page} totalPages={totalPages} setPage={setPage} />
      </div>
      </section>
      {selected && <Modal title="Settlement details" onClose={() => setSelected(null)}><div className="dialog-body"><div className="order-summary"><div><Badge value={selected.status} /><p>{fmtDate(selected.startDate)} <UiIcon name="arrow" /> {fmtDate(selected.endDate)}</p></div><strong>{pkr(selected.amountPaisa)}</strong></div><div className="definition"><span>Paid at</span><b>{fmtDateTime(selected.paidAt)}</b></div><div className="definition"><span>Reference</span><b>{selected.paymentReference ?? '—'}</b></div><div className="definition"><span>Created</span><b>{fmtDateTime(selected.createdAt)}</b></div></div></Modal>}
      {node}
    </div>
  );
}
