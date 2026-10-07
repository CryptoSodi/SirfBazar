import { lazy, Suspense, useEffect, useState } from 'react';
import { api, pkr } from '../lib/api';
import { Badge, Modal, Stat, btnCls, btnGhost, inputCls, useToast } from '../components/ui';
import { useThemeStudio, type ThemeMode } from '../components/ThemeStudio';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { PageSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';
const ShopMapPicker = lazy(() => import('../components/ShopMapPicker'));

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
  const initialMerchant = readMemory<any>('merchant:profile');
  const [merchant, setMerchant] = useState<any>(initialMerchant ?? null);
  const [form, setForm] = useState<Form>(initialMerchant ? toForm(initialMerchant) : blank);
  const [loading, setLoading] = useState(!initialMerchant);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stateBusy, setStateBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentType, setDocumentType] = useState('BUSINESS_REGISTRATION');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const { toast, node } = useToast();
  const { mode, setMode } = useThemeStudio();

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(!readMemory('merchant:profile'));
    setError('');
    try {
      const m = await api.get('/merchant/profile');
      setMerchant(m);
      setForm(toForm(m));
      writeMemory('merchant:profile', m);
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
      writeMemory('merchant:profile', updated);
      setForm(toForm(updated));
      setEditing(false);
      window.dispatchEvent(new Event('sb:shop-status'));
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
      window.dispatchEvent(new Event('sb:shop-status'));
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setStateBusy(false);
    }
  };

  const addDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!documentFile) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('documentType', documentType);
      form.append('file', documentFile);
      await api.upload('/merchant/documents/upload', form);
      setDocumentOpen(false); setDocumentFile(null); await load();
      toast('Merchant document submitted for verification');
    } catch (e: any) { toast(e.message, false); }
    finally { setSaving(false); }
  };

  const openDocument = async (document: any) => {
    try {
      if (!String(document.documentUrl || '').startsWith('/api/merchant/documents/')) {
        const legacyUrl = new URL(String(document.documentUrl || ''));
        if (!['http:', 'https:'].includes(legacyUrl.protocol)) {
          throw new Error('This legacy document link uses an unsupported protocol.');
        }
        window.open(legacyUrl.toString(), '_blank', 'noopener,noreferrer');
        return;
      }
      const blob = await api.download(`/merchant/documents/${encodeURIComponent(document.id)}/file`);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { toast(e.message, false); }
  };

  if (loading && !merchant) return <PageSkeleton variant="settings" label="Loading shop settings" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!merchant) return <p className="text-sm text-slate-400">No shop found.</p>;

  const isOnline = !!merchant.isOnline;
  const isOpen = !!merchant.isOpen;

  return (
    <div>
      <section className="page-heading"><div><div className="kicker">Store management</div><h1>Shop settings</h1><p>Your shop identity, storefront controls and workspace preferences.</p></div></section>
      {!canEdit && <div className="state-banner warning"><ReferenceIcon name="lock" /><div><b>Read-only settings</b><p>You do not have the Store permission to edit shop details or storefront controls.</p></div></div>}
      <div className="settings-grid">
        <section className="panel panel-pad">
          <div className="between"><h2>Shop details</h2><button type="button" className="btn tiny" disabled={!canEdit} onClick={() => setEditing(true)}>Edit details <ReferenceIcon name="edit" size="sm" /></button></div>
          <div className="section-divider" />
          <div className="row"><span className="store-monogram" style={{ width: 52, height: 52 }} aria-hidden="true">{String(merchant.shopName || 'SB').slice(0, 2).toUpperCase()}</span><div><h3>{merchant.shopName}</h3><p className="small muted">{[merchant.area, merchant.city].filter(Boolean).join(', ')}</p></div><Badge value={merchant.approvalStatus} /></div>
          <div className="definition" style={{ marginTop: 18 }}><span>Address</span><b>{merchant.address || '—'}</b></div>
          <div className="definition"><span>Contact</span><b>{merchant.phoneNumber || '—'}</b></div>
          <div className="definition"><span>Opening hours</span><b>{merchant.openingTime && merchant.closingTime ? `${merchant.openingTime} – ${merchant.closingTime}` : 'Not set'}</b></div>
          <div className="definition"><span>Preparation time</span><b>{merchant.averagePreparationMinutes ?? '—'} min</b></div>
          <div className="definition"><span>Service radius</span><b>{merchant.serviceRadiusKm ?? '—'} km</b></div>
          <div className="definition"><span>Minimum order</span><b>{pkr(merchant.minimumOrderValuePaisa)}</b></div>
          <div className="section-divider" /><h2>Appearance</h2><p className="small muted" style={{ marginTop: 6 }}>Choose what feels comfortable. Your shop’s data stays unchanged.</p>
          <div className="swatch-row">{(['light', 'dark', 'system'] as ThemeMode[]).map((choice) => <button type="button" key={choice} className={`theme-swatch ${choice}`} aria-pressed={mode === choice} onClick={() => setMode(choice)}><span aria-hidden="true" /><b>{choice[0].toUpperCase() + choice.slice(1)}</b><small>{choice === 'system' ? 'Follow device' : `Always ${choice}`}</small></button>)}</div>
        </section>
        <section className="panel panel-pad"><h2>Storefront controls</h2><p className="small muted" style={{ marginTop: 5 }}>Separate settings. Separate API actions.</p>
          <div className="setting-line"><div><b>Shop open</b><p>{isOpen ? 'Open' : 'Closed'} for new orders.</p></div><button type="button" className="btn tiny" disabled={!canEdit || stateBusy} onClick={() => toggleState(isOpen ? 'close' : 'open', isOpen ? 'Shop closed' : 'Shop opened')}>{isOpen ? 'Close shop' : 'Open shop'}</button></div>
          <div className="setting-line"><div><b>Shop online</b><p>{isOnline ? 'Online' : 'Offline'} in customer-facing availability.</p></div><button type="button" className="btn tiny" disabled={!canEdit || stateBusy} onClick={() => toggleState(isOnline ? 'offline' : 'online', isOnline ? 'Shop is now offline' : 'Shop is now online')}>{isOnline ? 'Go offline' : 'Go online'}</button></div>
          <p className="small muted" style={{ marginTop: 18 }}>Changing these flags does not record a delivery, cancel an order or prove storefront availability.</p>
          <div className="section-divider" /><h3>Approval status</h3><p className="small muted" style={{ marginTop: 7 }}>This status is supplied by the backend.</p><div style={{ marginTop: 12 }}><Badge value={merchant.approvalStatus} /></div>
          <div className="section-divider" /><div className="definition"><span>Rating</span><b>{(merchant.ratingAverage ?? 0).toFixed(1)} / 5 · {merchant.ratingCount ?? 0} reviews</b></div><div className="definition"><span>Commission</span><b>{merchant.commissionType === 'FIXED' ? pkr(merchant.commissionValue) : `${merchant.commissionValue ?? 0}%`}</b></div><div className="definition"><span>Shop type</span><b>{String(merchant.shopType ?? '—').replace(/_/g, ' ')}</b></div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}><div className="panel-head"><div><h2>Merchant documents</h2><p>Verification files attached to this merchant profile.</p></div><button type="button" className="btn primary" disabled={!canEdit} onClick={() => setDocumentOpen(true)}><ReferenceIcon name="upload" size="sm" /> Add document</button></div><div className="table-wrap"><table><thead><tr><th>Document</th><th>Status</th><th>Submitted</th><th>File</th></tr></thead><tbody>{(merchant.documents ?? []).map((document: any) => <tr key={document.id}><td>{String(document.documentType).replace(/_/g, ' ')}</td><td><Badge value={document.verificationStatus} /></td><td>{new Date(document.createdAt).toLocaleDateString()}</td><td><button type="button" className="btn tiny" onClick={() => void openDocument(document)}>Open</button></td></tr>)}{(merchant.documents ?? []).length === 0 && <tr><td colSpan={4}>No merchant documents have been submitted.</td></tr>}</tbody></table></div></section>

      {/* Live state controls */}
      <div hidden className="grid gap-4 sm:grid-cols-2">
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
      <div hidden className="grid gap-4 sm:grid-cols-3">
        <Stat label="Rating" value={`${(merchant.ratingAverage ?? 0).toFixed(1)} ★`} hint={`${merchant.ratingCount ?? 0} reviews`} />
        <Stat
          label="Commission"
          value={merchant.commissionType === 'FIXED' ? pkr(merchant.commissionValue) : `${merchant.commissionValue ?? 0}%`}
          hint="Set by admin"
        />
        <Stat label="Shop type" value={String(merchant.shopType ?? '—').replace(/_/g, ' ')} hint={merchant.email ?? 'No email on file'} />
      </div>

      {false && !canEdit && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          You do not have the Store permission, so shop details are read-only.
        </p>
      )}

      {/* Editable form */}
      {editing && <Modal title="Edit shop details" onClose={() => setEditing(false)}><form onSubmit={save} className="dialog-body space-y-5">
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
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <button type="button" className={btnGhost} disabled={!canEdit} onClick={() => setMapOpen(true)}>Pin shop on map</button>
              <span className="text-xs text-slate-500">{form.latitude && form.longitude ? `Pinned at ${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}` : 'No shop location pinned yet'}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
      </form></Modal>}

      {documentOpen && <Modal title="Add merchant document" onClose={() => { setDocumentOpen(false); setDocumentFile(null); }}><form className="dialog-body space-y-3" onSubmit={addDocument}><label className="field">Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="BUSINESS_REGISTRATION">Business registration</option><option value="IDENTITY">Identity</option><option value="BANK_DETAILS">Bank details</option><option value="OTHER">Other</option></select></label><label className="field">Document file<input type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} /><small>PDF, JPG, PNG or WebP, up to 10 MB. Files are kept outside the public static directory and require an authenticated merchant session to open.</small></label><div className="row"><button type="button" className="btn" onClick={() => { setDocumentOpen(false); setDocumentFile(null); }}>Cancel</button><button className="btn primary" disabled={saving || !documentFile}>{saving ? 'Submitting…' : 'Upload document'}</button></div></form></Modal>}
      {node}
      {mapOpen && <Suspense fallback={<div role="status">Loading map…</div>}><ShopMapPicker initial={form.latitude && form.longitude ? { latitude: Number(form.latitude), longitude: Number(form.longitude) } : null} onClose={() => setMapOpen(false)} onConfirm={(point) => { setForm((previous) => ({ ...previous, latitude: String(point.latitude), longitude: String(point.longitude) })); setMapOpen(false); toast('Shop pin selected. Save changes to publish it.'); }} /></Suspense>}
    </div>
  );
}
