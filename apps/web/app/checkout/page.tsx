'use client';
import { ToastMessage } from '@/components/Toast';
import { AppIcon as UiIcon } from '../../components/AppIcon';


import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fetchCart, getStoredUser, isLoggedIn } from '@/lib/api';
import { CheckoutRecovery, clearCheckoutRecovery, isDefinitiveNoWrite, readCheckoutRecovery, saveCheckoutRecovery } from '@/lib/checkout-recovery';
import { formatPKR } from '@/lib/format';
import { LoginSheet } from '@/components/LoginSheet';
import { useModalFocus } from '@/components/useModalFocus';
import { hasMapsKey } from '@/lib/maps';
import type { PickedPoint } from '@/components/MapPicker';

const MapPicker = dynamic(() => import('@/components/MapPicker').then((module) => module.MapPicker), { ssr: false });
const OpenMapPicker = dynamic(() => import('@/components/OpenMapPicker').then((module) => module.OpenMapPicker), { ssr: false });

const DRAFT_KEY = 'sb.checkoutDraft';
type Draft = { contactName: string; contactPhone: string; fullAddress: string; city: string; instructions: string; latitude: number | null; longitude: number | null };
type DraftTextField = 'contactName' | 'contactPhone' | 'fullAddress' | 'city' | 'instructions';
const emptyDraft: Draft = { contactName: '', contactPhone: '', fullAddress: '', city: '', instructions: '', latitude: null, longitude: null };

function readDraft(): Draft {
  try {
    const stored = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
    return { ...emptyDraft, ...stored,
      latitude: typeof stored.latitude === 'number' && Number.isFinite(stored.latitude) ? stored.latitude : null,
      longitude: typeof stored.longitude === 'number' && Number.isFinite(stored.longitude) ? stored.longitude : null };
  }
  catch { return emptyDraft; }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const mapTrigger = useRef<HTMLButtonElement>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [approved, setApproved] = useState<any>(null);
  const [recovery, setRecovery] = useState<CheckoutRecovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const uncertainFocus = useModalFocus<HTMLDivElement>(uncertain);

  const owner = getStoredUser()?.id as string | undefined;

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
  useEffect(() => {
    if (!owner) { setRecovery(null); return; }
    try { setRecovery(readCheckoutRecovery(owner)); }
    catch (cause: any) { setError(cause.message); setUncertain(true); }
  }, [owner]);

  const changeDraft = (field: DraftTextField, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value,
      ...(field === 'fullAddress' || field === 'city' ? { latitude: null, longitude: null } : {}) }));
    setReviewed(false);
    setApproved(null);
  };

  const closeMap = () => { setShowMap(false); requestAnimationFrame(() => mapTrigger.current?.focus()); };
  const pinLocation = (point: PickedPoint) => {
    setDraft((previous) => ({ ...previous, latitude: point.latitude, longitude: point.longitude }));
    setLocationError(''); setReviewed(false); setApproved(null); closeMap();
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationError('Location is unavailable. Pin the delivery point on the map.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDraft((previous) => ({ ...previous, latitude: coords.latitude, longitude: coords.longitude }));
        setReviewed(false); setApproved(null); setLocating(false);
      },
      () => { setLocationError('Location access failed. Pin the delivery point on the map.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const validateDraft = () => {
    if (!draft.contactName.trim()) return 'Enter the recipient name.';
    if (!/^\+?[0-9\s-]{10,16}$/.test(draft.contactPhone.trim())) return 'Enter a valid delivery contact number.';
    if (!draft.fullAddress.trim()) return 'Enter the house, street and area.';
    if (!draft.city.trim()) return 'Enter the delivery city.';
    if (draft.latitude === null || draft.longitude === null || !Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude) || Math.abs(draft.latitude) > 90 || Math.abs(draft.longitude) > 180) return 'Pin your delivery location on the map or use current location.';
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
        latitude: draft.latitude, longitude: draft.longitude,
      });
      setAddresses((previous) => [...previous, address]);
      setAddressId(address.id);
      setNotice('Delivery details saved. Review your basket and total before placing the order.');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const reviewOrder = async () => {
    setBusy(true); setError(''); setNotice(''); setReviewed(false); setApproved(null);
    try {
      const current = await fetchCart();
      setCart(current);
      if (!current || typeof current.id !== 'string' || !current.id.trim() || !Array.isArray(current.groups) || !current.groups.length) {
        throw new Error('Your basket could not be verified. Open your basket, review its items, then return to checkout.');
      }
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
      if (!current.id || !addressId) throw new Error('Choose a saved delivery address before reviewing your order.');
      const next = await api.post('/orders/quote', { cartId: current.id, deliveryAddressId: addressId, paymentMethod: 'COD', couponCode: current.couponCode || undefined });
      if (next?.version !== 1 || !next.approvedQuote || !next.quote || !Number.isSafeInteger(next.quote.totalAmountPaisa)) throw new Error('An approved order total is unavailable. Try reviewing again.');
      const changed = cart && (cart.totalPaisa !== current.totalPaisa || JSON.stringify(cart.groups) !== JSON.stringify(current.groups));
      setApproved(next);
      setReviewed(!changed);
      if (changed) setNotice('Your basket or price changed. Check the updated items and total, then select Review order again.');
      else setNotice('Review the approved items, address and total before placing the order.');
    } catch (e: any) { setError(e.message || 'Unable to check the basket. Try again.'); }
    finally { setBusy(false); }
  };

  const placeOrder = async () => {
    if (!reviewed || !approved || !addressId || !signedIn || !owner || !cart?.id || recovery) return;
    setBusy(true); setError('');
    let saved: CheckoutRecovery | null = null;
    let persisted = false;
    try {
      saved = { version: 1, owner, state: 'pending', payload: {
        requestId: crypto.randomUUID(), cartId: cart.id, approvedQuote: approved.approvedQuote,
        deliveryAddressId: addressId, paymentMethod: 'COD',
        customerNote: draft.instructions.trim() || undefined, couponCode: cart.couponCode || undefined,
      } };
      saveCheckoutRecovery(saved);
      persisted = true;
      setRecovery(saved);
      const order = await api.post('/orders', saved.payload);
      if (order?.id !== saved.payload.requestId) throw new Error('Order reference did not match. Check its saved status.');
      clearCheckoutRecovery(saved); setRecovery(null);
      sessionStorage.removeItem(DRAFT_KEY);
      window.dispatchEvent(new Event('sb:cart'));
      router.push(`/orders/${order.id}`);
    } catch (e: any) {
      if (!saved || !persisted) { setError(e.message || 'Unable to save checkout on this device.'); return; }
      if (!handleNoWrite(e, saved)) { setRecovery(saved); setUncertain(true); }
    } finally { setBusy(false); }
  };

  const handleNoWrite = (cause: any, saved: CheckoutRecovery): boolean => {
    if (!isDefinitiveNoWrite(cause?.status, cause?.code)) return false;
    clearCheckoutRecovery(saved); setRecovery(null); setUncertain(false); setReviewed(false);
    if (cause.code === 'QUOTE_CHANGED') {
      const replacement = cause?.details?.approvedQuote
        ? { version: 1, approvedQuote: cause.details.approvedQuote, expiresAt: cause.details.expiresAt, quote: cause.details.quote }
        : null;
      setApproved(replacement);
      setNotice(replacement ? 'The approved total changed. Review the new amount and select Review order again.' : 'The order changed or expired. Check your basket and request a new review.');
    } else {
      setApproved(null);
      setError(`${cause?.message || 'Order was not placed.'} Review your details before trying again.`);
    }
    return true;
  };

  const checkSavedOrder = async () => {
    if (!recovery || !owner || recovery.owner !== owner) return;
    setBusy(true); setError('');
    try {
      const order = await api.get(`/orders/${recovery.payload.requestId}`);
      if (order?.id !== recovery.payload.requestId) throw new Error('Saved order identity did not match. Contact support with your reference.');
      clearCheckoutRecovery(recovery); setRecovery(null); setUncertain(false);
      router.push(`/orders/${order.id}`);
    } catch (cause: any) {
      if (cause?.status === 404) setNotice('No saved order was found yet. You may retry the exact saved request; keep this reference.');
      else setError(cause?.message || 'Unable to check this order. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  const retrySavedOrder = async () => {
    if (!recovery || !owner || recovery.owner !== owner) return;
    setBusy(true); setError('');
    try {
      const order = await api.post('/orders', recovery.payload);
      if (order?.id !== recovery.payload.requestId) throw new Error('Saved order identity did not match. Contact support with your reference.');
      clearCheckoutRecovery(recovery); setRecovery(null); setUncertain(false);
      router.push(`/orders/${order.id}`);
    } catch (cause: any) {
      if (!handleNoWrite(cause, recovery)) setError(cause?.message || 'Still unable to confirm this order. Keep its reference and check again.');
    }
    finally { setBusy(false); }
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

  if (recovery) return <section className="card p-6" aria-labelledby="recovery-title"><h1 id="recovery-title" className="text-xl font-bold">Check your saved order</h1><p className="mt-3">This checkout may already have placed an order. Reference: <code>{recovery.payload.requestId}</code></p><p className="mt-2">Check its saved status before retrying the same request. Keep this reference if you contact support.</p>{notice && <ToastMessage ok>{notice}</ToastMessage>}{error && <ToastMessage>{error}</ToastMessage>}<div className="mt-4 flex flex-wrap gap-3"><button className="btn-primary" disabled={busy} onClick={() => void checkSavedOrder()}>Check saved order</button><button className="btn-secondary" disabled={busy} onClick={() => void retrySavedOrder()}>Retry saved request</button><Link className="btn-secondary" href="/contact">Contact support</Link></div></section>;
  if (loading && !cart) return <p role="status">Loading checkout…</p>;
  if (!cart) return <div role="alert" className="card p-5"><p>{error || 'Checkout could not load.'}</p><button className="btn-secondary mt-3" onClick={() => void refresh()}>Try again</button></div>;
  if (!(cart.groups ?? []).length) return <div className="card p-6"><h1 className="text-xl font-bold">Your basket is empty</h1><Link href="/cart" className="btn-primary mt-4 inline-flex">Back to basket</Link></div>;

  return (
    <div className="sb-checkout">
      <nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/cart">Your basket</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><span>Checkout</span></nav>
      <h1>A few details, then you’re done.</h1>
      <p className="sb-muted">No password to create. Your basket stays with you.</p>
      <div className="sb-checkout-steps" aria-label="Checkout progress"><span><UiIcon name="check" size={18} /> Basket</span><span>2 {reviewed ? 'Review & place order' : 'Delivery details'}</span><span>3 Confirmation</span></div>
      <div className="sb-checkout-grid">
        <div className="sb-checkout-main">
          <section className="card sb-checkout-panel">
            <h2><span className="sb-step-number">1</span>Where should we deliver?</h2>
            {signedIn && addresses.length > 0 && <fieldset className="sb-address-options"><legend className="sr-only">Saved delivery addresses</legend>{addresses.map((a) => <label key={a.id} className={addressId === a.id ? 'sb-address-option selected' : 'sb-address-option'}><input type="radio" name="address" checked={addressId === a.id} onChange={() => { setAddressId(a.id); setReviewed(false); setApproved(null); }} /><span><strong>{a.label || 'Delivery address'}</strong><small>{a.fullAddress}, {a.city}</small></span></label>)}</fieldset>}
            <p className="sb-muted">{signedIn ? 'Select a saved address or enter new delivery details.' : 'Enter your delivery details now. They will be saved only after you sign in.'}</p>
            <div className="sb-address-form">
              <label>Recipient name<input className="input" autoComplete="name" value={draft.contactName} onChange={(e) => changeDraft('contactName', e.target.value)} /></label>
              <label>Delivery contact number<input className="input" inputMode="tel" autoComplete="tel" value={draft.contactPhone} onChange={(e) => changeDraft('contactPhone', e.target.value)} /></label>
              <label className="sb-field-wide">House / apartment, street & area<input className="input" autoComplete="street-address" value={draft.fullAddress} onChange={(e) => changeDraft('fullAddress', e.target.value)} /></label>
              <label>City<input className="input" autoComplete="address-level2" value={draft.city} onChange={(e) => changeDraft('city', e.target.value)} /></label>
              <div className="sb-field-wide"><p className="sb-muted">Pin the delivery point for this address. Moving the street or city field clears the pin so it can be checked again.</p><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary text-sm" disabled={locating} onClick={useCurrentLocation}>{locating ? 'Locating…' : 'Use current location'}</button><button ref={mapTrigger} type="button" className="btn-secondary text-sm" onClick={() => setShowMap(true)}>Pin on map</button></div>{draft.latitude !== null && draft.longitude !== null && <p role="status" className="mt-2 text-sm text-emerald-700">Pinned: {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}</p>}{locationError && <p role="alert" className="mt-2 text-sm text-red-700">{locationError}</p>}</div>
              <label className="sb-field-wide">Delivery instructions <span className="sb-muted">(optional)</span><textarea className="input" rows={3} value={draft.instructions} onChange={(e) => changeDraft('instructions', e.target.value)} /></label>
            </div>
            {signedIn && <button className="btn-secondary mt-4" onClick={() => void saveDraft()} disabled={busy}>Save as new address</button>}
          </section>
          <section className="card sb-checkout-panel"><h2><span className="sb-step-number">2</span>How would you like to pay?</h2><div className="sb-payment-selected"><UiIcon name="checkCircle" size={22} /><span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span></div><p className="sb-muted mt-3">Online payment is unavailable until a live payment provider is verified.</p></section>
        </div>
        <aside className="card sb-checkout-panel sb-checkout-summary"><h2>Your order summary</h2>{approved?.quote ? <dl>
          {approved.quote.items?.map((item: any) => <div key={item.merchantProductId}><dt>{item.quantity} × {item.name}</dt><dd>{formatPKR(item.quantity * item.unitPricePaisa)}</dd></div>)}
          <div><dt>Items subtotal</dt><dd>{formatPKR(approved.quote.subtotalPaisa)}</dd></div>
          {approved.quote.merchants?.map((merchant: any) => <div key={merchant.merchantId}><dt>{merchant.shopName} delivery</dt><dd>{formatPKR(merchant.deliveryFeePaisa)}</dd></div>)}
          <div><dt>Service fee</dt><dd>{formatPKR(approved.quote.serviceFeePaisa)}</dd></div>
          {approved.quote.smallOrderFeePaisa > 0 && <div><dt>Small order fee</dt><dd>{formatPKR(approved.quote.smallOrderFeePaisa)}</dd></div>}
          {approved.quote.discountPaisa > 0 && <div><dt>Discount</dt><dd>−{formatPKR(approved.quote.discountPaisa)}</dd></div>}
          <div className="sb-total"><dt>Total to pay</dt><dd>{formatPKR(approved.quote.totalAmountPaisa)}</dd></div>
        </dl> : <dl>
          <div><dt>Items subtotal ({cart.itemCount})</dt><dd>{formatPKR(cart.subtotalPaisa)}</dd></div>
          {cart.groups.map((g: any) => <div key={g.merchant.id}><dt>{g.merchant.shopName} delivery</dt><dd>{formatPKR(g.deliveryFeePaisa)}</dd></div>)}
          <div><dt>Service fee</dt><dd>{formatPKR(cart.serviceFeePaisa)}</dd></div>
          {cart.smallOrderFeePaisa > 0 && <div><dt>Small order fee</dt><dd>{formatPKR(cart.smallOrderFeePaisa)}</dd></div>}
          {cart.discountPaisa > 0 && <div><dt>Discount</dt><dd>−{formatPKR(cart.discountPaisa)}</dd></div>}
          <div className="sb-total"><dt>Total to pay</dt><dd>{formatPKR(approved?.quote?.totalAmountPaisa ?? cart.totalPaisa)}</dd></div>
        </dl>}<p className="sb-muted mt-3">Prices and availability are checked again before you place the order.</p>
          {approved?.quote && <div className="sb-notice mt-3"><strong>Approved order review</strong><p>Deliver to {approved.quote.deliveryAddress?.fullAddress}, {approved.quote.deliveryAddress?.city}</p><p>{approved.quote.items?.length ?? 0} items · {formatPKR(approved.quote.totalAmountPaisa)} · Cash on delivery</p></div>}
          {notice && <ToastMessage ok>{notice}</ToastMessage>}
          {error && <ToastMessage>{error}</ToastMessage>}
          <button className="btn-primary mt-4 w-full" disabled={busy} onClick={onContinue}>{busy ? 'Please wait…' : !signedIn ? 'Continue to sign in' : !addressId ? 'Save delivery details' : reviewed ? 'Place order' : 'Review order'}</button>
          <p className="sb-muted mt-3 text-center">{cart.groups.length === 1 ? 'One shop, one delivery.' : `${cart.groups.length} shops will make separate deliveries.`}</p>
        </aside>
      </div>
      <div className="sb-checkout-mobile-action"><span><small>Total to pay</small><strong>{formatPKR(approved?.quote?.totalAmountPaisa ?? cart.totalPaisa)}</strong></span><button className="btn-primary" disabled={busy} onClick={onContinue}>{busy ? 'Please wait…' : !signedIn ? 'Continue to sign in' : !addressId ? 'Save address' : reviewed ? 'Place order' : 'Review order'}&nbsp; <UiIcon name="arrow" size={18} /></button></div>
      {showLogin && <LoginSheet title="Sign in or create an account" description="Continue to review your basket before placing an order. Your delivery details stay here." onClose={() => setShowLogin(false)} onSuccess={() => { setShowLogin(false); setReviewed(false); setNotice('Your basket has been merged. Check the items and total before placing the order.'); void refresh(); }} />}
      {showMap && (hasMapsKey ? <MapPicker initial={draft.latitude !== null && draft.longitude !== null ? { latitude: draft.latitude, longitude: draft.longitude } : null} onConfirm={pinLocation} onClose={closeMap} returnFocusTo={mapTrigger.current} /> : <OpenMapPicker initial={draft.latitude !== null && draft.longitude !== null ? { latitude: draft.latitude, longitude: draft.longitude } : null} onConfirm={pinLocation} onClose={closeMap} returnFocusTo={mapTrigger.current} />)}
      {uncertain && <div className="sb-modal-backdrop"><div ref={uncertainFocus.ref} onKeyDown={uncertainFocus.onKeyDown} tabIndex={-1} className="card sb-modal" role="alertdialog" aria-modal="true" aria-labelledby="order-uncertain-title"><h2 id="order-uncertain-title">We’re checking your order</h2><p>The response didn’t arrive. Your order may already have been created. Do not place it again yet.</p><Link className="btn-primary mt-4 inline-flex w-full justify-center" href="/orders">Check order status</Link><Link className="btn-secondary mt-2 inline-flex w-full justify-center" href="/contact">Contact support</Link></div></div>}
    </div>
  );
}
