import { useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnDanger, inputCls, useToast } from '../components/ui';

export default function Coupons() {
  const { items, loading, error, reload } = usePaged('/admin/coupons', {});
  const [creating, setCreating] = useState(false);
  const { toast, node } = useToast();

  const deactivate = async (c: any) => {
    if (!confirm(`Deactivate coupon ${c.code}?`)) return;
    try {
      await api.del(`/admin/coupons/${c.id}`);
      toast('Coupon deactivated');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Coupons</h1>
        <button className={btnCls} onClick={() => setCreating(true)}>+ New coupon</button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Code', 'Title', 'Discount', 'Min order', 'Validity', 'Used', 'Status', '']}>
        {items.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-mono font-bold">{c.code}</td>
            <td className="px-4 py-2.5">{c.title}{c.newUsersOnly && <span className="ml-1 text-xs text-emerald-600">(new users)</span>}</td>
            <td className="px-4 py-2.5">
              {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : c.discountType === 'FIXED' ? pkr(c.discountValue) : 'Free delivery'}
              {c.maxDiscountAmountPaisa && <div className="text-xs text-slate-400">max {pkr(c.maxDiscountAmountPaisa)}</div>}
            </td>
            <td className="px-4 py-2.5">{pkr(c.minimumOrderAmountPaisa)}</td>
            <td className="px-4 py-2.5 text-xs">{new Date(c.startDate).toLocaleDateString()} → {new Date(c.endDate).toLocaleDateString()}</td>
            <td className="px-4 py-2.5">{c._count?.usages ?? 0}×</td>
            <td className="px-4 py-2.5"><Badge value={c.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
            <td className="px-4 py-2.5 text-right">
              {c.isActive && <button className={btnDanger} onClick={() => deactivate(c)}>Deactivate</button>}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No coupons.</td></tr>}
      </Table>
      {creating && <CouponModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} toast={toast} />}
      {node}
    </div>
  );
}

function CouponModal({ onClose, onSaved, toast }: any) {
  const [form, setForm] = useState({
    code: '',
    title: '',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    maxDiscountRs: '',
    minOrderRs: '0',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    usageLimitPerCustomer: '1',
    newUsersOnly: false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/admin/coupons', {
        code: form.code,
        title: form.title,
        discountType: form.discountType,
        discountValue: form.discountType === 'FIXED' ? Math.round(Number(form.discountValue) * 100) : Number(form.discountValue),
        maxDiscountAmountPaisa: form.maxDiscountRs ? Math.round(Number(form.maxDiscountRs) * 100) : undefined,
        minimumOrderAmountPaisa: Math.round(Number(form.minOrderRs) * 100),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate + 'T23:59:59').toISOString(),
        usageLimitPerCustomer: Number(form.usageLimitPerCustomer),
        newUsersOnly: form.newUsersOnly,
      });
      toast('Coupon created');
      onSaved();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New coupon" onClose={onClose}>
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <select className={inputCls} value={form.discountType} onChange={set('discountType')}>
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED">Fixed Rs off</option>
            <option value="FREE_DELIVERY">Free delivery</option>
          </select>
        </div>
        <input className={inputCls} placeholder="Title shown to customers" value={form.title} onChange={set('title')} />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-500">{form.discountType === 'PERCENTAGE' ? 'Percent' : 'Rs value'}
            <input className={inputCls} value={form.discountValue} onChange={set('discountValue')} disabled={form.discountType === 'FREE_DELIVERY'} />
          </label>
          <label className="text-xs text-slate-500">Max discount Rs
            <input className={inputCls} value={form.maxDiscountRs} onChange={set('maxDiscountRs')} />
          </label>
          <label className="text-xs text-slate-500">Min order Rs
            <input className={inputCls} value={form.minOrderRs} onChange={set('minOrderRs')} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">Start
            <input className={inputCls} type="date" value={form.startDate} onChange={set('startDate')} />
          </label>
          <label className="text-xs text-slate-500">End
            <input className={inputCls} type="date" value={form.endDate} onChange={set('endDate')} />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-500">Uses per customer
            <input className={inputCls} value={form.usageLimitPerCustomer} onChange={set('usageLimitPerCustomer')} />
          </label>
          <label className="mt-4 flex items-center gap-2"><input type="checkbox" checked={form.newUsersOnly} onChange={set('newUsersOnly')} /> New users only</label>
        </div>
        <button className={`${btnCls} w-full`} onClick={save} disabled={busy || !form.code || !form.title}>
          {busy ? 'Creating…' : 'Create coupon'}
        </button>
      </div>
    </Modal>
  );
}
