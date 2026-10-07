import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, pkr, statusLabel } from '../lib/api';
import { readRider, readRiderOrders, readRiders, type MerchantRider, type RiderOrder } from '../lib/merchant-contracts';
import { Badge, Table, btnCls, btnDanger, btnGhost, inputCls, Modal, useToast } from '../components/ui';

const VEHICLE_TYPES = ['MOTORBIKE', 'BICYCLE', 'CAR', 'ON_FOOT'];

export default function Riders() {
  const { toast, node } = useToast();
  const [items, setItems] = useState<MerchantRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    setItems([]);
    try {
      const res = await api.get('/merchant/riders');
      setItems(readRiders(res));
    } catch (e) {
      setItems([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Riders</h1>
        <button className={btnCls} onClick={() => setAdding(true)}>
          Add rider
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-700" role="alert">Unable to load riders. {error} <button type="button" className={btnGhost} onClick={reload}>Retry</button></p>}

      {!error && <Table headers={['Rider', 'Vehicle', 'Online', 'Status', 'Actions']}>
        {items.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">
              {r.fullName}
              <div className="text-xs text-slate-400">{r.phoneNumber}</div>
            </td>
            <td className="px-4 py-2.5 text-xs">
              {r.vehicleType?.replace(/_/g, ' ') ?? '—'}
              {r.vehicleNumber && ` · ${r.vehicleNumber}`}
            </td>
            <td className="px-4 py-2.5 text-xs">{r.isOnline ? '🟢 online' : '⚪ offline'}</td>
            <td className="px-4 py-2.5">
              <Badge value={r.approvalStatus === 'PENDING' ? 'PENDING' : r.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </td>
            <td className="px-4 py-2.5 text-right">
              <button type="button" className={btnGhost} onClick={() => setSelectedId(r.id)} aria-label={`View ${r.fullName} details`}>Details</button>{' '}
              {r.approvalStatus === 'PENDING' ? (
                <div className="flex justify-end gap-2">
                  <button className={btnCls} onClick={() => decide(r, 'approve')}>Approve</button>
                  <button className={btnDanger} onClick={() => confirm(`Reject ${r.fullName}?`) && decide(r, 'reject')}>
                    Reject
                  </button>
                </div>
              ) : r.isActive ? (
                <button
                  className={btnDanger}
                  onClick={() => confirm(`Deactivate ${r.fullName}?`) && setActive(r, false)}
                >
                  Deactivate
                </button>
              ) : (
                <button className={btnGhost} onClick={() => setActive(r, true)}>
                  Activate
                </button>
              )}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
              No riders yet.
            </td>
          </tr>
        )}
        {loading && (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
              Loading…
            </td>
          </tr>
        )}
      </Table>}

      {selectedId && <RiderDetail key={selectedId} riderId={selectedId} onClose={() => setSelectedId(null)} />}

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
      {loading ? <p role="status">Loading rider details…</p> : error ? <p role="alert" className="text-red-700">Unable to load this rider. {error} <button type="button" className={btnGhost} onClick={reload}>Retry</button></p> : rider && <>
        <div><h3 className="text-lg font-semibold">{rider.fullName}</h3><p>{rider.phoneNumber}</p><p>{rider.vehicleType.replace(/_/g, ' ')}{rider.vehicleNumber ? ` · ${rider.vehicleNumber}` : ''}</p></div>
        <div className="flex flex-wrap gap-2"><Badge value={rider.approvalStatus} /><Badge value={rider.isActive ? 'ACTIVE' : 'INACTIVE'} /><span className="text-slate-600">{rider.isOnline ? 'Online' : 'Offline'}</span></div>
        {rider.currentOrderId && <p className="rounded-xl bg-amber-50 p-3">Current order reference: <span className="font-mono">{rider.currentOrderId}</span></p>}
        <section aria-labelledby="rider-orders-heading"><h4 id="rider-orders-heading" className="font-semibold">Recent assigned orders</h4>{orders.length === 0 ? <p className="mt-2 text-slate-500">No assigned orders in the latest 100.</p> : <ul className="mt-2 divide-y divide-slate-100">{orders.map((order) => <li key={order.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-mono">{order.orderNumber}</span><span>{statusLabel(order.status)}</span><span>{pkr(order.totalAmountPaisa)}</span></li>)}</ul>}</section>
      </>}
    </div>
  </Modal>;
}
