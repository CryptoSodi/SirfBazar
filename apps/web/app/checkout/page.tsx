'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, fetchCart, isLoggedIn } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { LoginSheet } from '@/components/LoginSheet';
import { useModalFocus } from '@/components/useModalFocus';

const DRAFT_KEY = 'sb.checkoutDraft';
type Draft = { contactName: string; contactPhone: string; fullAddress: string; city: string; instructions: string };
const emptyDraft: Draft = { contactName: '', contactPhone: '', fullAddress: '', city: '', instructions: '' };

function readDraft(): Draft {
  try { return { ...emptyDraft, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') }; }
  catch { return emptyDraft; }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [signedIn, setSignedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const uncertainFocus = useModalFocus<HTMLDivElement>(uncertain);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCart = await fetchCart();
      setCart(nextCart);
      if (isLoggedIn()) {
        setSignedIn(true);
        const nextAddresses = await api.get('/customer/addresses');
        setAddresses(nextAddresses);
        setAddressId((previous) => previous || (readDraft().fullAddress ? '' : nextAddresses.find((a: any) => a.isDefault)?.id || nextAddresses[0]?.id || ''));
      } else {
        setSignedIn(false);
      }
    } catch (e: any) {
      setError(e.message || 'Unable to load checkout. Check your connection and try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setDraft(readDraft()); void refresh(); }, [refresh]);
  useEffect(() => { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }, [draft]);

  const changeDraft = (field: keyof Draft, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setReviewed(false);
  };

  const validateDraft = () => {
    if (!draft.contactName.trim()) return 'Enter the recipient name.';
    if (!/^\+?[0-9\s-]{10,16}$/.test(draft.contactPhone.trim())) return 'Enter a valid delivery contact number.';
    if (!draft.fullAddress.trim()) return 'Enter the house, street and area.';
    if (!draft.city.trim()) return 'Enter the delivery city.';
    return '';
  };

  const saveDraft = async () => {
    const invalid = validateDraft();
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try {
      const address = await api.post('/customer/addresses', {
        label: 'Home', contactName: draft.contactName.trim(), contactPhone: draft.contactPhone.trim(),
        fullAddress: draft.fullAddress.trim(), city: draft.city.trim(),
        instructions: draft.instructions.trim() || undefined,
      });
      setAddresses((previous) => [...previous, address]);
      setAddressId(address.id);
      setNotice('Delivery details saved. Review your basket and total before placing the order.');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const reviewOrder = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const current = await fetchCart();
      setCart(current);
      if (current.groups.some((group: any) => group.items.some((item: any) => item.inStock === false))) {
        setReviewed(false);
        setError('An item is unavailable. Remove or replace it in your basket before placing the order.');
        return;
      }
      if (!Number.isFinite(current.totalPaisa) || current.totalPaisa < 0 || current.groups.some((group: any) => !Number.isFinite(group.deliveryFeePaisa))) {
        setReviewed(false);
        setError('A complete order total is unavailable. Please check your basket before continuing.');
        return;
      }
      const changed = cart && (cart.totalPaisa !== current.totalPaisa || JSON.stringify(cart.groups) !== JSON.stringify(current.groups));
      setReviewed(!changed);
      if (changed) setNotice('Your basket or price changed. Check the updated items and total, then select Review order again.');
      else setNotice('Review complete. Place order only when the address, items and total are correct.');
    } catch (e: any) { setError(e.message || 'Unable to check the basket. Try again.'); }
    finally { setBusy(false); }
  };

  const placeOrder = async () => {
    if (!reviewed || !addressId || !signedIn || !Number.isFinite(cart?.totalPaisa)) return;
    setBusy(true); setError('');
    try {
      const order = await api.post('/orders', {
        deliveryAddressId: addressId, paymentMethod: 'COD',
        customerNote: draft.instructions.trim() || undefined,
        couponCode: cart?.couponCode || undefined,
      });
      sessionStorage.removeItem(DRAFT_KEY);
      window.dispatchEvent(new Event('sb:cart'));
      router.push(`/orders/${order.id}`);
    } catch (e: any) {
      if (e?.status == null || e.status >= 500) setUncertain(true);
      else { setError(e.message || 'Order not placed. Check your details and review again.'); setReviewed(false); }
    } finally { setBusy(false); }
  };

  const onContinue = () => {
    setError('');
    if (!Number.isFinite(cart?.totalPaisa) || cart.totalPaisa < 0) {
      setError('A complete order total is unavailable. Please check your basket before continuing.');
      return;
    }
    if (!signedIn) {
      const invalid = validateDraft();
      if (invalid) { setError(invalid); return; }
      setShowLogin(true);
    } else if (!addressId) void saveDraft();
    else if (!reviewed) void reviewOrder();
    else void placeOrder();
  };

  if (loading && !cart) return <p role="status">Loading checkout…</p>;
  if (!cart) return <div role="alert" className="card p-5"><p>{error || 'Checkout could not load.'}</p><button className="btn-secondary mt-3" onClick={() => void refresh()}>Try again</button></div>;
  if (!(cart.groups ?? []).length) return <div className="card p-6"><h1 className="text-xl font-bold">Your basket is empty</h1><Link href="/cart" className="btn-primary mt-4 inline-flex">Back to basket</Link></div>;

  return (
    <div className="sb-checkout">
      <nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/cart">Your basket</Link><span aria-hidden="true">›</span><span>Checkout</span></nav>
      <h1>A few details, then you’re done.</h1>
      <p className="sb-muted">No password to create. Your basket stays with you.</p>
      <div className="sb-checkout-steps" aria-label="Checkout progress"><span>✓ Basket</span><span>2 {reviewed ? 'Review & place order' : 'Delivery details'}</span><span>3 Confirmation</span></div>
      <div className="sb-checkout-grid">
        <div className="sb-checkout-main">
          <section className="card sb-checkout-panel">
            <h2><span className="sb-step-number">1</span>Where should we deliver?</h2>
            {signedIn && addresses.length > 0 && <fieldset className="sb-address-options"><legend className="sr-only">Saved delivery addresses</legend>{addresses.map((a) => <label key={a.id} className={addressId === a.id ? 'sb-address-option selected' : 'sb-address-option'}><input type="radio" name="address" checked={addressId === a.id} onChange={() => { setAddressId(a.id); setReviewed(false); }} /><span><strong>{a.label || 'Delivery address'}</strong><small>{a.fullAddress}, {a.city}</small></span></label>)}</fieldset>}
            <p className="sb-muted">{signedIn ? 'Select a saved address or enter new delivery details.' : 'Enter your delivery details now. They will be saved only after you sign in.'}</p>
            <div className="sb-address-form">
              <label>Recipient name<input className="input" autoComplete="name" value={draft.contactName} onChange={(e) => changeDraft('contactName', e.target.value)} /></label>
              <label>Delivery contact number<input className="input" inputMode="tel" autoComplete="tel" value={draft.contactPhone} onChange={(e) => changeDraft('contactPhone', e.target.value)} /></label>
              <label className="sb-field-wide">House / apartment, street & area<input className="input" autoComplete="street-address" value={draft.fullAddress} onChange={(e) => changeDraft('fullAddress', e.target.value)} /></label>
              <label>City<input className="input" autoComplete="address-level2" value={draft.city} onChange={(e) => changeDraft('city', e.target.value)} /></label>
              <label className="sb-field-wide">Delivery instructions <span className="sb-muted">(optional)</span><textarea className="input" rows={3} value={draft.instructions} onChange={(e) => changeDraft('instructions', e.target.value)} /></label>
            </div>
            {signedIn && <button className="btn-secondary mt-4" onClick={() => void saveDraft()} disabled={busy}>Save as new address</button>}
          </section>
          <section className="card sb-checkout-panel"><h2><span className="sb-step-number">2</span>How would you like to pay?</h2><div className="sb-payment-selected"><span aria-hidden="true">◉</span><span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span></div><p className="sb-muted mt-3">Online payment is unavailable until a live payment provider is verified.</p></section>
        </div>
        <aside className="card sb-checkout-panel sb-checkout-summary"><h2>Your order summary</h2><dl>
          <div><dt>Items subtotal ({cart.itemCount})</dt><dd>{formatPKR(cart.subtotalPaisa)}</dd></div>
          {cart.groups.map((g: any) => <div key={g.merchant.id}><dt>{g.merchant.shopName} delivery</dt><dd>{formatPKR(g.deliveryFeePaisa)}</dd></div>)}
          <div><dt>Service fee</dt><dd>{formatPKR(cart.serviceFeePaisa)}</dd></div>
          {cart.smallOrderFeePaisa > 0 && <div><dt>Small order fee</dt><dd>{formatPKR(cart.smallOrderFeePaisa)}</dd></div>}
          {cart.discountPaisa > 0 && <div><dt>Discount</dt><dd>−{formatPKR(cart.discountPaisa)}</dd></div>}
          <div className="sb-total"><dt>Total to pay</dt><dd>{formatPKR(cart.totalPaisa)}</dd></div>
        </dl><p className="sb-muted mt-3">Prices and availability are checked again before you place the order.</p>
          {notice && <p role="status" className="sb-notice">{notice}</p>}
          {error && <p role="alert" className="sb-error">{error}</p>}
          <button className="btn-primary mt-4 w-full" disabled={busy} onClick={onContinue}>{busy ? 'Please wait…' : !signedIn ? 'Continue to sign in' : !addressId ? 'Save delivery details' : reviewed ? 'Place order' : 'Review order'}</button>
          <p className="sb-muted mt-3 text-center">{cart.groups.length === 1 ? 'One shop, one delivery.' : `${cart.groups.length} shops will make separate deliveries.`}</p>
        </aside>
      </div>
      <div className="sb-checkout-mobile-action"><span><small>Total to pay</small><strong>{formatPKR(cart.totalPaisa)}</strong></span><button className="btn-primary" disabled={busy} onClick={onContinue}>{busy ? 'Please wait…' : !signedIn ? 'Continue to sign in' : !addressId ? 'Save address' : reviewed ? 'Place order' : 'Review order'}&nbsp; →</button></div>
      {showLogin && <LoginSheet title="Continue to checkout" description="Sign in, then review your basket and place the order yourself." onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); setReviewed(false); setNotice('Your basket has been merged. Check the items and total before placing the order.'); void refresh(); }} />}
      {uncertain && <div className="sb-modal-backdrop"><div ref={uncertainFocus.ref} onKeyDown={uncertainFocus.onKeyDown} tabIndex={-1} className="card sb-modal" role="alertdialog" aria-modal="true" aria-labelledby="order-uncertain-title"><h2 id="order-uncertain-title">We’re checking your order</h2><p>The response didn’t arrive. Your order may already have been created. Do not place it again yet.</p><Link className="btn-primary mt-4 inline-flex w-full justify-center" href="/orders">Check order status</Link><Link className="btn-secondary mt-2 inline-flex w-full justify-center" href="/contact">Contact support</Link></div></div>}
    </div>
  );
}
