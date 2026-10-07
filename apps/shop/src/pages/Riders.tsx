import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, pkr, statusLabel } from '../lib/api';
import { readRider, readRiderOrders, readRiders, type MerchantRider, type RiderOrder } from '../lib/merchant-contracts';
import { Badge, btnCls, btnGhost, inputCls, Modal, useToast } from '../components/ui';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { InlineSkeleton, PageSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';

const VEHICLE_TYPES = ['MOTORBIKE', 'BICYCLE', 'CAR', 'ON_FOOT'];

export default function Riders() {
  const { toast, node } = useToast();
  const initialRiders = readMemory<MerchantRider[]>('riders');
  const [items, setItems] = useState<MerchantRider[]>(initialRiders ?? []);
  const [loading, setLoading] = useState(!initialRiders);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MerchantRider | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'requests'>('all');

  const reload = useCallback(async () => {
    setLoading(!readMemory<MerchantRider[]>('riders'));
    setError('');
    try {
      const res = await api.get('/merchant/riders');
      const nextItems = readRiders(res);
      setItems(nextItems);
      writeMemory('riders', nextItems);
    } catch (e) {
      if (!readMemory('riders')) setItems([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const realtime = () => void reload();
    window.addEventListener('sb:riders', realtime);
    return () => window.removeEventListener('sb:riders', realtime);
  }, [reload]);

  const setActive = async (r: any, active: boolean) => {
    try {
      await api.post(`/merchant/riders/${r.id}/${active ? 'activate' : 'deactivate'}`);
      toast(active ? 'Rider activated' : 'Rider deactivated');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  const decide = async (r: any, action: 'approve' | 'reject') => {
    try {
      await api.post(`/merchant/riders/${r.id}/${action}`);
      toast(action === 'approve' ? 'Rider approved' : 'Request rejected');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  const remove = async (r: MerchantRider) => {
    if (!confirm(`Remove ${r.fullName} from active rider access? Completed delivery records will be preserved.`)) return;
    try { await api.del(`/merchant/riders/${r.id}`); toast('Rider removed from active access'); await reload(); }
    catch (e: any) { toast(e.message, false); }
  };

  const visible = items.filter((r) => filter === 'all' || (filter === 'active' ? r.isActive : r.approvalStatus === 'PENDING'));
  const activeCount = items.filter((r) => r.isActive).length;
  const requestCount = items.filter((r) => r.approvalStatus === 'PENDING').length;

  if (loading && items.length === 0) return <PageSkeleton variant="cards" label="Loading riders" />;

  return (
    <div>
      <section className="page-heading"><div><div className="kicker">Delivery team</div><h1>Riders</h1><p>Keep the right people ready for local deliveries.</p></div><div className="heading-actions"><button type="button" className="btn primary" onClick={() => setAdding(true)}><ReferenceIcon name="plus" size="sm" />Add rider</button></div></section>
      <div className="mini-stats"><span><b className="num">{items.length}</b> riders</span><span><b className="num">{activeCount}</b> active</span><span><b className="num">{requestCount}</b> requests</span></div>
      <div className="toolbar"><div className="tabs" aria-label="Rider filter">{([['all', 'All riders'], ['active', 'Active'], ['requests', 'Requests']] as const).map(([key, label]) => <button type="button" key={key} className={`tab ${filter === key ? 'active' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
      {!error && <div className="card-grid" aria-live="polite">{visible.map((r) => <article className="panel person-card" key={r.id}>
        <span className="avatar" aria-hidden="true">{r.fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
        <h3>{r.fullName}</h3><p className="details">{r.vehicleType?.replace(/_/g, ' ') ?? 'Vehicle not set'}{r.vehicleNumber ? ` · ${r.vehicleNumber}` : ''}<br />{r.phoneNumber}</p>
        <div className="person-status"><span className={`badge ${r.approvalStatus === 'PENDING' ? 'amber' : 'green'}`}>{r.approvalStatus?.replace(/_/g, ' ')}</span><span className={`badge ${r.isActive ? 'green' : ''}`}>{r.isActive ? 'Active' : 'Inactive'}</span><span className={`badge ${r.isOnline ? 'green' : ''}`}>{r.isOnline ? 'Online' : 'Offline'}</span></div>
        <div className="card-action"><span className="row"><button type="button" className="btn tiny" onClick={() => setSelectedId(r.id)}>View <ReferenceIcon name="right" size="sm" /></button><button type="button" className="btn tiny" onClick={() => setEditing(r)}>Edit</button></span>{r.approvalStatus === 'PENDING' ? <span><button type="button" className="btn tiny primary" onClick={() => decide(r, 'approve')}>Approve</button> <button type="button" className="btn tiny danger" onClick={() => confirm(`Reject ${r.fullName}?`) && decide(r, 'reject')}>Reject</button></span> : <span className="row"><button type="button" className="btn tiny" onClick={() => r.isActive ? (confirm(`Deactivate ${r.fullName}?`) && setActive(r, false)) : setActive(r, true)}>{r.isActive ? 'Deactivate' : 'Activate'}</button><button type="button" className="btn tiny danger" onClick={() => void remove(r)}>Remove</button></span>}</div>
      </article>)}{!loading && visible.length === 0 && <div className="panel empty"><span className="empty-icon"><ReferenceIcon name="rider" /></span><h2>No riders to show</h2><p>{filter === 'requests' ? 'New rider requests will appear here.' : 'Add a rider to start building your delivery team.'}</p></div>}</div>}
      {loading && <div className="panel empty" role="status">Loading riders…</div>}

      {error && <p className="mb-3 text-sm text-red-700" role="alert">Unable to load riders. {error} <button type="button" className={btnGhost} onClick={reload}>Retry</button></p>}


      {selectedId && <RiderDetail key={selectedId} riderId={selectedId} onClose={() => setSelectedId(null)} />}
      {editing && <EditRiderModal rider={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); toast('Rider details updated'); }} onError={(message) => toast(message, false)} />}

      {adding && (
        <AddRiderModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
            toast('Rider added');
          }}
          onError={(m) => toast(m, false)}
        />
      )}

      {node}
    </div>
  );
}

function AddRiderModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('MOTORBIKE');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/merchant/riders', {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        vehicleType,
        ...(vehicleNumber.trim() ? { vehicleNumber: vehicleNumber.trim() } : {}),
      });
      onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add rider" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Full name</label>
          <input
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Rider name"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Phone number</label>
          <input
            className={inputCls}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+923001234567"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Vehicle type</label>
          <select className={inputCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Vehicle number <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className={inputCls}
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            placeholder="ABC-123"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnCls} disabled={saving}>
            {saving ? 'Saving…' : 'Add rider'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditRiderModal({ rider, onClose, onSaved, onError }: { rider: MerchantRider; onClose: () => void; onSaved: () => void; onError: (message: string) => void }) {
  const [fullName, setFullName] = useState(rider.fullName);
  const [vehicleType, setVehicleType] = useState(rider.vehicleType || 'MOTORBIKE');
  const [vehicleNumber, setVehicleNumber] = useState(rider.vehicleNumber || '');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { await api.put(`/merchant/riders/${rider.id}`, { fullName: fullName.trim(), vehicleType, vehicleNumber: vehicleNumber.trim() }); onSaved(); }
    catch (error: any) { onError(error.message); }
    finally { setBusy(false); }
  };
  return <Modal title="Edit rider" onClose={onClose}><form className="dialog-body space-y-3" onSubmit={submit}><label className="field">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className="field">Vehicle type<select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>{VEHICLE_TYPES.map((value) => <option value={value} key={value}>{value.replace(/_/g, ' ')}</option>)}</select></label><label className="field">Vehicle number<input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} /></label><div className="row"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save rider'}</button></div></form></Modal>;
}

function RiderDetail({ riderId, onClose }: { riderId: string; onClose: () => void }) {
  const [rider, setRider] = useState<MerchantRider | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    setRider(null);
    setOrders([]);
    try {
      const [detail, assigned] = await Promise.all([
        api.get(`/merchant/riders/${riderId}`),
        api.get(`/merchant/riders/${riderId}/orders`),
      ]);
      setRider(readRider(detail));
      setOrders(readRiderOrders(assigned));
    } catch (e) {
      setRider(null);
      setOrders([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => { void reload(); }, [reload]);

  return <Modal title="Rider details" onClose={onClose}>
    <div className="space-y-4 p-1 text-sm">
      {loading ? <InlineSkeleton label="Loading rider details" rows={5} /> : error ? <p role="alert" className="text-red-700">Unable to load this rider. {error} <button type="button" className={btnGhost} onClick={reload}>Retry</button></p> : rider && <>
        <div><h3 className="text-lg font-semibold">{rider.fullName}</h3><p>{rider.phoneNumber}</p><p>{rider.vehicleType.replace(/_/g, ' ')}{rider.vehicleNumber ? ` · ${rider.vehicleNumber}` : ''}</p></div>
        <div className="flex flex-wrap gap-2"><Badge value={rider.approvalStatus} /><Badge value={rider.isActive ? 'ACTIVE' : 'INACTIVE'} /><span className="text-slate-600">{rider.isOnline ? 'Online' : 'Offline'}</span></div>
        {rider.currentOrderId && <p className="rounded-xl bg-amber-50 p-3">Current order reference: <span className="font-mono">{rider.currentOrderId}</span></p>}
        <section aria-labelledby="rider-orders-heading"><h4 id="rider-orders-heading" className="font-semibold">Recent assigned orders</h4>{orders.length === 0 ? <p className="mt-2 text-slate-500">No assigned orders in the latest 100.</p> : <ul className="mt-2 divide-y divide-slate-100">{orders.map((order) => <li key={order.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-mono">{order.orderNumber}</span><span>{statusLabel(order.status)}</span><span>{pkr(order.totalAmountPaisa)}</span></li>)}</ul>}</section>
      </>}
    </div>
  </Modal>;
}
