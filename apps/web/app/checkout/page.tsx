'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, fetchCart, isLoggedIn } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { useLocation } from '@/lib/location';
import { LoginSheet } from '@/components/LoginSheet';

const PAYMENT_METHODS = [
  { id: 'COD', label: 'Cash on delivery', icon: '💵' },
  { id: 'JAZZCASH', label: 'JazzCash', icon: '📱' },
  { id: 'EASYPAISA', label: 'EasyPaisa', icon: '📲' },
  { id: 'CARD', label: 'Debit / credit card', icon: '💳' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { location } = useLocation();
  const [cart, setCart] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [method, setMethod] = useState('COD');
  const [note, setNote] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = async () => {
    setLoggedIn(isLoggedIn());
    fetchCart().then(setCart).catch(() => undefined);
    if (isLoggedIn()) {
      try {
        const addrs = await api.get('/customer/addresses');
        setAddresses(addrs);
        const def = addrs.find((a: any) => a.isDefault) ?? addrs[0];
        if (def) setAddressId(def.id);
        else setShowNewAddress(true);
      } catch {
        /* not a customer yet */
      }
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const placeOrder = async () => {
    // THE checkout rule: only here do we demand a login.
    if (!isLoggedIn()) {
      setShowLogin(true);
      return;
    }
    if (!addressId) {
      setError('Choose or add a delivery address first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await api.post('/orders', {
        deliveryAddressId: addressId,
        paymentMethod: method,
        customerNote: note.trim() || undefined,
        couponCode: cart?.couponCode ?? undefined,
      });
      window.dispatchEvent(new Event('sb:cart'));
      if (order.status === 'PAYMENT_PENDING') {
        router.push(`/orders/${order.id}?pay=1`);
      } else {
        router.push(`/orders/${order.id}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cart) return <p className="text-stone-500">Loading…</p>;
  if ((cart.groups ?? []).length === 0) {
    router.replace('/cart');
    return null;
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <h1 className="text-xl font-bold">Checkout</h1>

        {/* Address */}
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Delivery address</h2>
          {!loggedIn ? (
            <p className="text-sm text-stone-500">
              You will confirm your address after a quick login at the last step — or{' '}
              <button className="text-emerald-700 underline" onClick={() => setShowLogin(true)}>
                login now
              </button>
              .
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {addresses.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${addressId === a.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200'}`}>
                    <input type="radio" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1" />
                    <span className="text-sm">
                      <b>{a.label}</b> — {a.fullAddress}
                      {a.contactPhone && <span className="block text-xs text-stone-500">{a.contactName} · {a.contactPhone}</span>}
                    </span>
                  </label>
                ))}
              </div>
              {showNewAddress ? (
                <NewAddressForm
                  onSaved={(a) => {
                    setAddresses((prev) => [...prev, a]);
                    setAddressId(a.id);
                    setShowNewAddress(false);
                  }}
                  onCancel={() => setShowNewAddress(false)}
                  defaultCoords={location}
                />
              ) : (
                <button className="btn-secondary mt-3 text-sm" onClick={() => setShowNewAddress(true)}>
                  + Add new address
                </button>
              )}
            </>
          )}
        </section>

        {/* Payment */}
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Payment method</h2>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${method === m.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200'}`}>
                <input type="radio" checked={method === m.id} onChange={() => setMethod(m.id)} />
                <span>{m.icon}</span> {m.label}
              </label>
            ))}
          </div>
          {method !== 'COD' && (
            <p className="mt-2 text-xs text-stone-500">You will complete the payment on the next screen (demo gateway in dev).</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-bold">Note for the shop (optional)</h2>
          <input className="input" placeholder="e.g. Ring the bell, ripe bananas please" value={note} onChange={(e) => setNote(e.target.value)} />
        </section>
      </div>

      {/* Summary */}
      <aside className="card h-fit p-5 lg:col-span-2">
        <h2 className="mb-3 font-bold">Order summary</h2>
        <div className="space-y-1.5 text-sm">
          {cart.groups.map((g: any) => (
            <div key={g.merchant.id} className="flex justify-between">
              <span className="truncate text-stone-500">🏪 {g.merchant.shopName} ({g.items.length})</span>
              <span>{formatPKR(g.subtotalPaisa)}</span>
            </div>
          ))}
          <div className="flex justify-between text-stone-500"><span>Delivery</span><span>{formatPKR(cart.deliveryFeePaisa)}</span></div>
          <div className="flex justify-between text-stone-500"><span>Fees</span><span>{formatPKR(cart.serviceFeePaisa + cart.smallOrderFeePaisa)}</span></div>
          {cart.discountPaisa > 0 && (
            <div className="flex justify-between text-emerald-700"><span>Discount ({cart.couponCode})</span><span>−{formatPKR(cart.discountPaisa)}</span></div>
          )}
          <div className="my-2 border-t border-dashed" />
          <div className="flex justify-between text-base font-bold"><span>To pay</span><span>{formatPKR(cart.totalPaisa)}</span></div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary mt-4 w-full" onClick={placeOrder} disabled={busy}>
          {busy ? 'Placing order…' : loggedIn ? 'Place order' : 'Login & place order'}
        </button>
        {cart.groups.length > 1 && (
          <p className="mt-2 text-center text-[11px] text-stone-400">
            Items come from {cart.groups.length} shops — each delivers separately, tracked on one screen.
          </p>
        )}
      </aside>

      {showLogin && (
        <LoginSheet
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            refresh(); // cart merged; addresses loaded; user stays on checkout
          }}
        />
      )}
    </div>
  );
}

function NewAddressForm({
  onSaved,
  onCancel,
  defaultCoords,
}: {
  onSaved: (a: any) => void;
  onCancel: () => void;
  defaultCoords: { latitude: number; longitude: number } | null;
}) {
  const [form, setForm] = useState({ label: 'Home', fullAddress: '', area: '', city: 'Lahore', contactName: '', contactPhone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.fullAddress.trim()) {
      setError('Address is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api.post('/customer/addresses', {
        ...form,
        latitude: defaultCoords?.latitude,
        longitude: defaultCoords?.longitude,
        isDefault: true,
      });
      onSaved(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-stone-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Label (Home/Office)" value={form.label} onChange={set('label')} />
        <input className="input" placeholder="City" value={form.city} onChange={set('city')} />
      </div>
      <input className="input" placeholder="Full address (house, street, block)" value={form.fullAddress} onChange={set('fullAddress')} />
      <input className="input" placeholder="Area (e.g. Gulberg III)" value={form.area} onChange={set('area')} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Contact name" value={form.contactName} onChange={set('contactName')} />
        <input className="input" placeholder="Contact phone" value={form.contactPhone} onChange={set('contactPhone')} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
        <button className="btn-secondary text-sm" onClick={onCancel}>Cancel</button>
      </div>
      <p className="text-[11px] text-stone-400">Your current map location is attached for accurate delivery distance.</p>
    </div>
  );
}
