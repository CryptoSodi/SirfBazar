import { ToastMessage } from '../components/Toast';
import { AppIcon } from '../components/AppIcon';
import { AppIcon as UiIcon } from '../components/AppIcon';
import { useRef, useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

const STATUSES = ['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
const statusName = (status: string) => ({ APPROVED: 'Active', SUSPENDED: 'Disabled', REJECTED: 'Disabled (legacy)', SUBMITTED: 'Pending (legacy)', UNDER_REVIEW: 'In review (legacy)' }[status] || status.replaceAll('_', ' '));
function ShopStatus({ value }: { value: string }) { return <Badge value={value === 'APPROVED' ? 'ACTIVE' : value === 'SUSPENDED' ? 'DISABLED' : value} />; }

export default function Merchants() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/merchants', { status, q });
  const [selected, setSelected] = useState<any>(null);
  const { toast, node } = useToast();
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);

  const act = async (id: string, action: string, body?: any) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true);
    const expected = action === 'suspend' ? 'SUSPENDED' : action === 'reject' ? 'REJECTED' : 'APPROVED';
    try {
      const saved = await api.post(`/admin/merchants/${id}/${action}`, body ?? {});
      if (saved?.ok !== true || saved.approvalStatus !== expected) throw new Error('Check the saved shop status before trying again.');
      toast(action === 'suspend' || action === 'reject' ? 'Shop disabled.' : 'Shop activated.');
      reload();
      setSelected(null);
    } catch (e: any) {
      try {
        const saved = await api.get(`/admin/merchants/${id}`);
        reload();
        if (saved.approvalStatus === expected) { toast('Saved shop access confirmed.'); setSelected(null); }
        else { setSelected(saved); toast(`${e.message} The latest shop status is shown.`, false); }
      } catch { toast('The access update could not be confirmed. Refresh the merchant list before trying again.', false); setSelected(null); reload(); }
    } finally { actionLock.current = false; setBusy(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Merchants</h1>
        <select aria-label="Shop access status" className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? statusName(s) : 'All statuses'}</option>
          ))}
        </select>
        <input aria-label="Search merchants" className={`${inputCls} max-w-xs`} placeholder="Search shop, city, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="mb-4">New shops start active with a one-month trial. Access continues afterward unless admin disables the shop.</p>
      {error && <ToastMessage>{error}</ToastMessage>}
      <Table headers={['Shop', 'Owner', 'City', 'Status', 'Online', 'Commission', 'Orders', '']}>
        {items.map((m) => (
          <tr key={m.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{m.shopName}<div className="text-xs text-slate-400">{m.shopType}</div></td>
            <td className="px-4 py-2.5">{m.user?.fullName}<div className="text-xs text-slate-400">{m.user?.phoneNumber}</div></td>
            <td className="px-4 py-2.5">{m.city}<div className="text-xs text-slate-400">{m.area}</div></td>
            <td className="px-4 py-2.5"><ShopStatus value={m.approvalStatus} /></td>
            <td className="px-4 py-2.5"><AppIcon name={m.isOnline ? "online" : "offline"} size={16} /> {m.isOnline ? 'Online' : 'Offline'} · {m.isOpen ? 'open' : 'closed'}</td>
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

      {selected && <MerchantModal key={selected.id} merchant={selected} busy={busy} onClose={() => { if (!busy) setSelected(null); }} act={act} reload={reload} toast={toast} />}
      {node}
    </div>
  );
}

function MerchantModal({ merchant, busy, onClose, act, reload, toast }: any) {
  const [commissionValue, setCommissionValue] = useState(String(merchant.commissionValue));
  const [radius, setRadius] = useState(String(merchant.serviceRadiusKm));
  const [disabling, setDisabling] = useState(false);
  const [reason, setReason] = useState('');

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
      <div className="merchant-access-modal space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
          <div><b>Shop access:</b> <ShopStatus value={merchant.approvalStatus} /></div>
          <div><b>Type:</b> {merchant.shopType}</div>
          <div><b>City:</b> {merchant.city} ({merchant.area})</div>
          <div><b>Min order:</b> {pkr(merchant.minimumOrderValuePaisa)}</div>
          <div><b>Rating:</b> <AppIcon name="star" size={16} /> {merchant.ratingAverage} ({merchant.ratingCount})</div>
          <div><b>Products:</b> {merchant._count?.products ?? '–'} · <b>Riders:</b> {merchant._count?.riders ?? '–'}</div>
        </div>

        <section className="ops-panel p-3" aria-label="Trial and continued access">
          <h3 className="font-semibold">One-month trial · no automatic lockout</h3>
          {merchant.trial?.endsAt && <p>Trial ends {new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeZone: 'Asia/Karachi' }).format(new Date(merchant.trial.endsAt))}.</p>}
          <p>Access continues after the trial. Only an admin can disable or reactivate this shop.</p>
        </section>

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
            <button className={btnCls} disabled={busy} onClick={() => act(merchant.id, merchant.approvalStatus === 'SUSPENDED' ? 'reactivate' : 'approve')}>
              <UiIcon name="check" size={18} /> {busy ? 'Saving…' : merchant.approvalStatus === 'SUSPENDED' ? 'Reactivate shop' : 'Activate shop'}
            </button>
          )}
          {['SUBMITTED', 'UNDER_REVIEW'].includes(merchant.approvalStatus) && (
            <button className={btnDanger} disabled={busy} onClick={() => setDisabling(true)}>
              <AppIcon name="close" size={16} /> Disable shop
            </button>
          )}
          {merchant.approvalStatus === 'APPROVED' && (
            <button className={btnDanger} disabled={busy} onClick={() => setDisabling(true)}>
              <AppIcon name="offline" size={16} /> Disable shop
            </button>
          )}
        </div>
        {disabling && <section className="ops-panel p-3 space-y-3" aria-labelledby="disable-shop-heading">
          <h3 id="disable-shop-heading" className="font-semibold">Disable {merchant.shopName}?</h3>
          <p>The shop and its products will be hidden from customers. Merchant operations, including IPOS, will be blocked until you reactivate it. Existing orders are not cancelled or refunded automatically.</p>
          <label className="block">Reason (optional)<textarea className={inputCls} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><button className={btnGhost} disabled={busy} onClick={() => setDisabling(false)}>Keep shop active</button><button className={btnDanger} disabled={busy} onClick={() => act(merchant.id, 'suspend', { reason: reason.trim() || undefined })}>{busy ? 'Disabling…' : 'Confirm disable'}</button></div>
        </section>}
      </div>
    </Modal>
  );
}
