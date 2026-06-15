import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Badge, Table, btnCls, btnDanger, btnGhost, inputCls, Modal, useToast } from '../components/ui';

const VEHICLE_TYPES = ['MOTORBIKE', 'BICYCLE', 'CAR', 'ON_FOOT'];

export default function Riders() {
  const { toast, node } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/merchant/riders');
      setItems(Array.isArray(res) ? res : (res?.items ?? []));
    } catch (e: any) {
      setError(e.message);
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

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <Table headers={['Rider', 'Vehicle', 'Online', 'Status', '']}>
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
      </Table>

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
