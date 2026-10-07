import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Badge, Modal } from '../components/ui';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { InlineSkeleton, PageSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';

const CATEGORIES = ['APP_ISSUE', 'ACCOUNT_ISSUE', 'PAYMENT_ISSUE', 'ORDER_ISSUE', 'RIDER_ISSUE', 'MERCHANT_ISSUE'];

export default function Support() {
  const initialTickets = readMemory<any[]>('support:tickets');
  const [tickets, setTickets] = useState<any[]>(initialTickets ?? []);
  const [loading, setLoading] = useState(!initialTickets);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(!readMemory('support:tickets')); setError(''); try { const result = await api.get('/support/tickets'); const nextTickets = Array.isArray(result) ? result : []; setTickets(nextTickets); writeMemory('support:tickets', nextTickets); } catch (cause) { setError(errorMessage(cause)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading && tickets.length === 0) return <PageSkeleton label="Loading support tickets" />;
  return <><section className="page-heading"><div><div className="kicker">Merchant assistance</div><h1>Support</h1><p>Create and follow support requests for your shop.</p></div><button className="btn primary" onClick={() => setCreating(true)}><ReferenceIcon name="plus" /> New ticket</button></section>{error && <div className="state-banner error"><ReferenceIcon name="alert" />{error}</div>}<section className="panel">{loading ? <div className="empty">Loading support tickets…</div> : tickets.length === 0 ? <div className="empty"><span className="empty-icon"><ReferenceIcon name="support" /></span><h2>No support tickets</h2><p>Create a ticket when your shop needs help.</p></div> : <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Category</th><th>Status</th><th>Priority</th><th>Updated</th><th /></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><b>{ticket.title}</b></td><td>{String(ticket.issueCategory).replace(/_/g, ' ')}</td><td><Badge value={ticket.status} /></td><td>{ticket.priority}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td><td><button className="btn tiny" onClick={() => setSelected(ticket.id)}>Open</button></td></tr>)}</tbody></table></div>}</section>{creating && <CreateTicket onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} onError={setError} />}{selected && <TicketDetail id={selected} onClose={() => setSelected(null)} />}</>;
}

function CreateTicket({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (value: string) => void }) {
  const [issueCategory, setIssueCategory] = useState('APP_ISSUE'); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [orderId, setOrderId] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api.post('/support/tickets', { issueCategory, title: title.trim(), description: description.trim(), ...(orderId.trim() ? { orderId: orderId.trim() } : {}) }); onSaved(); } catch (cause) { onError(errorMessage(cause)); } finally { setBusy(false); } };
  return <Modal title="Create support ticket" onClose={onClose}><form className="space-y-3" onSubmit={submit}><label className="field">Category<select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)}>{CATEGORIES.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label><label className="field">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field">Description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="field">Order ID (optional)<input value={orderId} onChange={(event) => setOrderId(event.target.value)} /></label><div className="row"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create ticket'}</button></div></form></Modal>;
}

function TicketDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<any>(null); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setTicket(await api.get(`/support/tickets/${id}`)); setError(''); } catch (cause) { setError(errorMessage(cause)); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  const send = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api.post(`/support/tickets/${id}/messages`, { message: message.trim() }); setMessage(''); await load(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); } };
  return <Modal title={ticket?.title ?? 'Support ticket'} onClose={onClose}>{error && <div className="inline-error">{error}</div>}{!ticket ? <InlineSkeleton label="Loading support ticket" rows={5} /> : <div className="space-y-3"><div className="between"><Badge value={ticket.status} /><span>{ticket.priority}</span></div><p>{ticket.description}</p>{ticket.order && <p className="small muted">Order {ticket.order.orderNumber} · {ticket.order.status}</p>}<div className="section-divider" /><h3>Messages</h3>{(ticket.messages ?? []).length === 0 ? <p className="small muted">No replies yet.</p> : (ticket.messages ?? []).map((entry: any) => <div className="customer-box" key={entry.id}><b>{entry.senderRole}</b><p>{entry.message}</p><small>{new Date(entry.createdAt).toLocaleString()}</small></div>)}<form onSubmit={send}><label className="field">Reply<textarea required value={message} onChange={(event) => setMessage(event.target.value)} /></label><button className="btn primary" disabled={busy || !message.trim()}>{busy ? 'Sending…' : 'Send reply'}</button></form></div>}</Modal>;
}
