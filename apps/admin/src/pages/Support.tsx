import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnGhost, inputCls, useToast } from '../components/ui';

const STATUSES = ['', 'OPEN', 'IN_REVIEW', 'WAITING_CUSTOMER', 'WAITING_MERCHANT', 'WAITING_RIDER', 'RESOLVED', 'REJECTED', 'ESCALATED'];

export default function Support() {
  const [status, setStatus] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/support-tickets', { status });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast, node } = useToast();

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Support tickets</h1>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Ticket', 'Category', 'Order', 'Customer', 'Priority', 'Status', 'Updated', '']}>
        {items.map((t) => (
          <tr key={t.id} className="hover:bg-slate-50">
            <td className="max-w-[220px] truncate px-4 py-2.5 font-medium" title={t.title}>{t.title}</td>
            <td className="px-4 py-2.5 text-xs">{t.issueCategory?.replace(/_/g, ' ')}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{t.order?.orderNumber ?? '—'}</td>
            <td className="px-4 py-2.5 text-xs">{t.customer?.user?.fullName ?? t.customer?.user?.phoneNumber ?? '—'}</td>
            <td className="px-4 py-2.5"><Badge value={t.priority} /></td>
            <td className="px-4 py-2.5"><Badge value={t.status} /></td>
            <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(t.updatedAt).toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right"><button className={btnGhost} onClick={() => setSelectedId(t.id)}>Open</button></td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No tickets.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {selectedId && <TicketModal ticketId={selectedId} onClose={() => setSelectedId(null)} toast={toast} reload={reload} />}
      {node}
    </div>
  );
}

function TicketModal({ ticketId, onClose, toast, reload }: any) {
  const [ticket, setTicket] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/admin/support-tickets/${ticketId}`).then(setTicket).catch((e) => toast(e.message, false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ticketId]);

  if (!ticket) return null;

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/support-tickets/${ticketId}/messages`, { message });
      setMessage('');
      await load();
      reload();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    try {
      await api.put(`/admin/support-tickets/${ticketId}`, { status });
      toast('Status updated');
      await load();
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <Modal title={ticket.title} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={ticket.status} />
          <Badge value={ticket.priority} />
          <span className="text-xs text-slate-400">{ticket.issueCategory?.replace(/_/g, ' ')}</span>
          {ticket.order && <span className="font-mono text-xs">{ticket.order.orderNumber}</span>}
        </div>
        <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{ticket.description}</p>

        <div className="max-h-56 space-y-2 overflow-y-auto">
          {(ticket.messages ?? []).map((m: any) => (
            <div key={m.id} className={`rounded-xl p-2.5 text-xs ${m.senderRole?.includes('ADMIN') || m.senderRole === 'SUPPORT_AGENT' ? 'ml-8 bg-emerald-50' : 'mr-8 bg-slate-100'}`}>
              <b>{m.senderRole?.replace(/_/g, ' ').toLowerCase()}</b> · {new Date(m.createdAt).toLocaleString()}
              <div className="mt-0.5 text-sm text-slate-700">{m.message}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input className={inputCls} placeholder="Reply to the customer…" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className={btnCls} onClick={send} disabled={busy || !message.trim()}>Send</button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['IN_REVIEW', 'WAITING_CUSTOMER', 'RESOLVED', 'REJECTED', 'ESCALATED'].map((s) => (
            <button key={s} className={`${btnGhost} text-xs`} onClick={() => setStatus(s)}>{s.replace(/_/g, ' ')}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
