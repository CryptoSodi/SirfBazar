import { useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { Badge, Stat, btnCls, btnGhost, inputCls, useToast } from '../components/ui';

/** Editable fields accepted by PUT /merchant/profile (UpdateMerchantProfileDto). */
type Form = {
  shopName: string;
  description: string;
  phoneNumber: string;
  address: string;
  city: string;
  area: string;
  latitude: string;
  longitude: string;
  serviceRadiusKm: string;
  openingTime: string;
  closingTime: string;
  minimumOrderRupees: string;
  averagePreparationMinutes: string;
  logoUrl: string;
  bannerUrl: string;
};

const blank: Form = {
  shopName: '',
  description: '',
  phoneNumber: '',
  address: '',
  city: '',
  area: '',
  latitude: '',
  longitude: '',
  serviceRadiusKm: '',
  openingTime: '',
  closingTime: '',
  minimumOrderRupees: '',
  averagePreparationMinutes: '',
  logoUrl: '',
  bannerUrl: '',
};

function toForm(m: any): Form {
  return {
    shopName: m.shopName ?? '',
    description: m.description ?? '',
    phoneNumber: m.phoneNumber ?? '',
    address: m.address ?? '',
    city: m.city ?? '',
    area: m.area ?? '',
    latitude: m.latitude != null ? String(m.latitude) : '',
    longitude: m.longitude != null ? String(m.longitude) : '',
    serviceRadiusKm: m.serviceRadiusKm != null ? String(m.serviceRadiusKm) : '',
    openingTime: m.openingTime ?? '',
    closingTime: m.closingTime ?? '',
    minimumOrderRupees: m.minimumOrderValuePaisa != null ? String(Math.round(m.minimumOrderValuePaisa / 100)) : '',
    averagePreparationMinutes: m.averagePreparationMinutes != null ? String(m.averagePreparationMinutes) : '',
    logoUrl: m.logoUrl ?? '',
    bannerUrl: m.bannerUrl ?? '',
  };
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: any }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

export default function Profile() {
  const [merchant, setMerchant] = useState<any>(null);
  const [form, setForm] = useState<Form>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stateBusy, setStateBusy] = useState(false);
  const { toast, node } = useToast();

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const m = await api.get('/merchant/profile');
      setMerchant(m);
      setForm(toForm(m));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Staff without the STORE permission cannot edit or toggle state (backend enforces too).
  const canEdit = !merchant || merchant.isOwner || (merchant.permissions ?? []).includes('STORE');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        shopName: form.shopName.trim(),
        description: form.description.trim() || undefined,
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        area: form.area.trim() || undefined,
        openingTime: form.openingTime.trim() || undefined,
        closingTime: form.closingTime.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        bannerUrl: form.bannerUrl.trim() || undefined,
      };
      if (form.latitude.trim() !== '') body.latitude = Number(form.latitude);
      if (form.longitude.trim() !== '') body.longitude = Number(form.longitude);
      if (form.serviceRadiusKm.trim() !== '') body.serviceRadiusKm = Number(form.serviceRadiusKm);
      if (form.minimumOrderRupees.trim() !== '') body.minimumOrderValuePaisa = Math.round(Number(form.minimumOrderRupees) * 100);
      if (form.averagePreparationMinutes.trim() !== '') body.averagePreparationMinutes = Math.round(Number(form.averagePreparationMinutes));

      const updated = await api.put('/merchant/profile', body);
      setMerchant((m: any) => ({ ...m, ...updated }));
      setForm(toForm(updated));
      toast('Shop details saved');
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setSaving(false);
    }
  };

  const toggleState = async (path: string, label: string) => {
    setStateBusy(true);
    try {
      await api.post(`/merchant/${path}`);
      toast(label);
      await load();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setStateBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Loading shop settings…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!merchant) return <p className="text-sm text-slate-400">No shop found.</p>;

  const isOnline = !!merchant.isOnline;
  const isOpen = !!merchant.isOpen;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Shop settings</h1>
        <Badge value={merchant.approvalStatus} />
      </div>

      {/* Live state controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Online status</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">Whether the shop appears to customers and can take orders.</div>
            </div>
            <button
              className={isOnline ? btnGhost : btnCls}
              disabled={!canEdit || stateBusy}
              onClick={() => toggleState(isOnline ? 'offline' : 'online', isOnline ? 'Shop is now offline' : 'Shop is now online')}
            >
              {isOnline ? 'Go offline' : 'Go online'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Store hours</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isOpen ? 'Open' : 'Closed'}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">Manually open or close the storefront for new orders.</div>
            </div>
            <button
              className={isOpen ? btnGhost : btnCls}
              disabled={!canEdit || stateBusy}
              onClick={() => toggleState(isOpen ? 'close' : 'open', isOpen ? 'Shop closed' : 'Shop opened')}
            >
              {isOpen ? 'Close shop' : 'Open shop'}
            </button>
          </div>
        </div>
      </div>

      {/* Read-only summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Rating" value={`${(merchant.ratingAverage ?? 0).toFixed(1)} ★`} hint={`${merchant.ratingCount ?? 0} reviews`} />
        <Stat
          label="Commission"
          value={merchant.commissionType === 'FIXED' ? pkr(merchant.commissionValue) : `${merchant.commissionValue ?? 0}%`}
          hint="Set by admin"
        />
        <Stat label="Shop type" value={String(merchant.shopType ?? '—').replace(/_/g, ' ')} hint={merchant.email ?? 'No email on file'} />
      </div>

      {!canEdit && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          You do not have the Store permission, so shop details are read-only.
        </p>
      )}

      {/* Editable form */}
      <form onSubmit={save} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <fieldset disabled={!canEdit || saving} className="space-y-5">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Shop details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shop name">
                <input className={inputCls} value={form.shopName} onChange={(e) => set('shopName', e.target.value)} required />
              </Field>
              <Field label="Phone number" hint="10–15 digits, optional leading +">
                <input className={inputCls} value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} />
              </Field>
            </div>
            <Field label="Description">
              <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Location</h2>
            <Field label="Address">
              <input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City">
                <input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="Area">
                <input className={inputCls} value={form.area} onChange={(e) => set('area', e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Latitude">
                <input className={inputCls} type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
              </Field>
              <Field label="Longitude">
                <input className={inputCls} type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
              </Field>
              <Field label="Service radius (km)" hint="Minimum 0.5">
                <input className={inputCls} type="number" step="0.5" min="0.5" value={form.serviceRadiusKm} onChange={(e) => set('serviceRadiusKm', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Hours &amp; orders</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Opening time" hint="e.g. 09:00">
                <input className={inputCls} type="time" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} />
              </Field>
              <Field label="Closing time" hint="e.g. 21:00">
                <input className={inputCls} type="time" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minimum order value (Rs)" hint={`Currently ${pkr(merchant.minimumOrderValuePaisa)}`}>
                <input className={inputCls} type="number" min="0" step="1" value={form.minimumOrderRupees} onChange={(e) => set('minimumOrderRupees', e.target.value)} />
              </Field>
              <Field label="Avg. preparation (minutes)" hint="Minimum 1">
                <input className={inputCls} type="number" min="1" step="1" value={form.averagePreparationMinutes} onChange={(e) => set('averagePreparationMinutes', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Branding</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Logo URL">
                <input className={inputCls} value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Banner URL">
                <input className={inputCls} value={form.bannerUrl} onChange={(e) => set('bannerUrl', e.target.value)} placeholder="https://…" />
              </Field>
            </div>
          </section>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <button type="submit" className={btnCls} disabled={!canEdit || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className={btnGhost} disabled={saving} onClick={() => setForm(toForm(merchant))}>
              Reset
            </button>
          </div>
        </fieldset>
      </form>

      {node}
    </div>
  );
}
