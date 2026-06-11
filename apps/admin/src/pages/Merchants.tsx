import { useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

const STATUSES = ['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];

export default function Merchants() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/merchants', { status, q });
  const [selected, setSelected] = useState<any>(null);
  const { toast, node } = useToast();

  const act = async (id: string, action: string, body?: any) => {
    try {
      await api.post(`/admin/merchants/${id}/${action}`, body ?? {});
      toast(`Merchant ${action}d`);
      reload();
      setSelected(null);
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Merchants</h1>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
        <input className={`${inputCls} max-w-xs`} placeholder="Search shop, city, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Shop', 'Owner', 'City', 'Status', 'Online', 'Commission', 'Orders', '']}>
        {items.map((m) => (
          <tr key={m.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{m.shopName}<div className="text-xs text-slate-400">{m.shopType}</div></td>
            <td className="px-4 py-2.5">{m.user?.fullName}<div className="text-xs text-slate-400">{m.user?.phoneNumber}</div></td>
            <td className="px-4 py-2.5">{m.city}<div className="text-xs text-slate-400">{m.area}</div></td>
            <td className="px-4 py-2.5"><Badge value={m.approvalStatus} /></td>
            <td className="px-4 py-2.5">{m.isOnline ? '🟢' : '⚪'} {m.isOpen ? 'open' : 'closed'}</td>
            <td className="px-4 py-2.5">{m.commissionType === 'PERCENTAGE' ? `${m.commissionValue}%` : pkr(m.commissionValue)}</td>
            <td className="px-4 py-2.5">{m._count?.orders ?? 0}</td>
            <td className="px-4 py-2.5 text-right">
              <button className={btnGhost} onClick={() => setSelected(m)}>Manage</button>
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && (
          <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No merchants found.</td></tr>
        )}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />

      {selected && <MerchantModal merchant={selected} onClose={() => setSelected(null)} act={act} reload={reload} toast={toast} />}
      {node}
    </div>
  );
}

function MerchantModal({ merchant, onClose, act, reload, toast }: any) {
  const [commissionValue, setCommissionValue] = useState(String(merchant.commissionValue));
  const [radius, setRadius] = useState(String(merchant.serviceRadiusKm));

  const saveTerms = async () => {
    try {
      await api.put(`/admin/merchants/${merchant.id}`, {
        commissionValue: Number(commissionValue),
        serviceRadiusKm: Number(radius),
      });
      toast('Terms updated');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <Modal title={merchant.shopName} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2 text-slate-600">
          <div><b>Status:</b> <Badge value={merchant.approvalStatus} /></div>
          <div><b>Type:</b> {merchant.shopType}</div>
          <div><b>City:</b> {merchant.city} ({merchant.area})</div>
          <div><b>Min order:</b> {pkr(merchant.minimumOrderValuePaisa)}</div>
          <div><b>Rating:</b> ⭐ {merchant.ratingAverage} ({merchant.ratingCount})</div>
          <div><b>Products:</b> {merchant._count?.products ?? '–'} · <b>Riders:</b> {merchant._count?.riders ?? '–'}</div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 font-semibold">Commission & service area</div>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-slate-500">
              Commission ({merchant.commissionType === 'PERCENTAGE' ? '%' : 'paisa'})
              <input className={inputCls} value={commissionValue} onChange={(e) => setCommissionValue(e.target.value)} />
            </label>
            <label className="flex-1 text-xs text-slate-500">
              Service radius (km)
              <input className={inputCls} value={radius} onChange={(e) => setRadius(e.target.value)} />
            </label>
          </div>
          <button className={`${btnCls} mt-2`} onClick={saveTerms}>Save terms</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {['SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'SUSPENDED'].includes(merchant.approvalStatus) && (
            <button className={btnCls} onClick={() => act(merchant.id, merchant.approvalStatus === 'SUSPENDED' ? 'reactivate' : 'approve')}>
              ✓ Approve
            </button>
          )}
          {['SUBMITTED', 'UNDER_REVIEW'].includes(merchant.approvalStatus) && (
            <button className={btnDanger} onClick={() => { const reason = prompt('Rejection reason:'); if (reason !== null) act(merchant.id, 'reject', { reason }); }}>
              ✗ Reject
            </button>
          )}
          {merchant.approvalStatus === 'APPROVED' && (
            <button className={btnDanger} onClick={() => { const reason = prompt('Suspension reason:'); if (reason !== null) act(merchant.id, 'suspend', { reason }); }}>
              ⏸ Suspend
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
