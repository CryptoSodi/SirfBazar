import { useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnGhost, inputCls, useToast } from '../components/ui';

export default function Settlements() {
  const [status, setStatus] = useState('');
  const { items, loading, error, reload } = usePaged('/admin/settlements', { status });
  const [generating, setGenerating] = useState(false);
  const { toast, node } = useToast();

  const markPaid = async (s: any) => {
    const ref = prompt(`Payment reference for ${pkr(s.amountPaisa)} payout to ${s.merchant?.shopName}:`, `PAYOUT-${Date.now()}`);
    if (!ref) return;
    try {
      await api.post(`/admin/settlements/${s.id}/mark-paid`, { paymentReference: ref });
      toast('Settlement paid');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  const hold = async (s: any) => {
    const notes = prompt('Hold reason:');
    if (notes === null) return;
    try {
      await api.post(`/admin/settlements/${s.id}/hold`, { notes });
      toast('Settlement held');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Settlements</h1>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {['', 'PENDING', 'PROCESSING', 'PAID', 'ON_HOLD', 'FAILED'].map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <button className={btnCls} onClick={() => setGenerating(true)}>⚙ Generate settlements</button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Shop', 'Period', 'Amount', 'Status', 'Paid at', 'Reference', '']}>
        {items.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{s.merchant?.shopName}</td>
            <td className="px-4 py-2.5 text-xs">{new Date(s.startDate).toLocaleDateString()} → {new Date(s.endDate).toLocaleDateString()}</td>
            <td className="px-4 py-2.5 font-semibold">{pkr(s.amountPaisa)}</td>
            <td className="px-4 py-2.5"><Badge value={s.status} /></td>
            <td className="px-4 py-2.5 text-xs">{s.paidAt ? new Date(s.paidAt).toLocaleString() : '—'}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{s.paymentReference ?? '—'}</td>
            <td className="space-x-1 px-4 py-2.5 text-right">
              {['PENDING', 'ON_HOLD', 'PROCESSING'].includes(s.status) && (
                <>
                  <button className={btnCls} onClick={() => markPaid(s)}>Mark paid</button>
                  {s.status !== 'ON_HOLD' && <button className={btnGhost} onClick={() => hold(s)}>Hold</button>}
                </>
              )}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No settlements yet — generate them for a period.</td></tr>}
      </Table>
      {generating && <GenerateModal onClose={() => setGenerating(false)} onDone={() => { setGenerating(false); reload(); }} toast={toast} />}
      {node}
    </div>
  );
}

function GenerateModal({ onClose, onDone, toast }: any) {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const created = await api.post('/admin/settlements/generate', {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + 'T23:59:59').toISOString(),
      });
      toast(`${created.length} settlement(s) generated`);
      onDone();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Generate settlements" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        Creates one payout per merchant covering delivered orders in the period that are not yet settled
        (earnings − completed refunds).
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="text-xs text-slate-500">From
          <input className={inputCls} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="text-xs text-slate-500">To
          <input className={inputCls} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>
      <button className={`${btnCls} mt-3 w-full`} onClick={generate} disabled={busy}>
        {busy ? 'Generating…' : 'Generate'}
      </button>
    </Modal>
  );
}
