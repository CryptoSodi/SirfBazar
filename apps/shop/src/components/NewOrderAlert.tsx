import { ToastMessage } from './Toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage, pkr } from '../lib/api';
import { readOrders, type MerchantOrder } from '../lib/merchant-contracts';
import { ReferenceIcon } from './ReferenceIcon';

const DISMISSED_KEY = 'sbs.dismissedNewOrderAlerts';
const DISMISS_TTL = 24 * 60 * 60 * 1000;

function dismissedOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}') as Record<string, number>;
    const current = Object.fromEntries(Object.entries(parsed).filter(([, at]) => Date.now() - at < DISMISS_TTL));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(current));
    return current;
  } catch {
    return {} as Record<string, number>;
  }
}

function dismissOrder(id: string) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify({ ...dismissedOrders(), [id]: Date.now() }));
}

async function playOrderTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    for (const [offset, frequency] of [[0, 740], [0.18, 880], [0.36, 740]] as Array<[number, number]>) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.15);
    }
    window.setTimeout(() => void context.close(), 750);
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    // Browsers may block sound until the merchant interacts with the page.
  }
}

export function NewOrderAlert() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [closed, setClosed] = useState<Record<string, number>>(() => dismissedOrders());
  const [busy, setBusy] = useState(false);
  const writeLock = useRef(false);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setOrders(readOrders(await api.get('/merchant/orders?status=SENT_TO_MERCHANT')));
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    const onOrders = () => void load();
    window.addEventListener('sb:orders', onOrders);
    window.addEventListener('focus', onOrders);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('sb:orders', onOrders);
      window.removeEventListener('focus', onOrders);
    };
  }, [load]);

  const visible = useMemo(() => orders.filter((order) => !closed[order.id]), [closed, orders]);
  const order = visible[0];

  useEffect(() => {
    if (!order) return;
    void playOrderTone();
    const sound = window.setInterval(() => { if (!document.hidden) void playOrderTone(); }, 12_000);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { window.clearInterval(sound); window.clearInterval(clock); };
  }, [order?.id]);

  if (!order) return null;

  const closeAlert = () => {
    dismissOrder(order.id);
    setClosed(dismissedOrders());
    setRejecting(false);
    setReason('');
  };

  const confirmState = async (expected: string) => {
    const fresh = await api.get(`/merchant/orders/${order.id}`);
    if (fresh?.status !== expected) throw new Error('The order action could not be confirmed.');
    await load();
    window.dispatchEvent(new Event('sb:orders'));
  };

  const accept = async () => {
    if (writeLock.current) return;
    writeLock.current = true;
    setBusy(true); setError('');
    try {
      const result = await api.post(`/merchant/orders/${order.id}/accept`);
      if (result?.status !== 'PREPARING') throw new Error('Acceptance could not be confirmed. Check the saved order.');
      await confirmState('PREPARING');
      navigate(`/orders?order=${encodeURIComponent(order.id)}`);
    } catch (cause) {
      try {
        const saved = await api.get(`/merchant/orders/${order.id}`);
        if (['PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_ARRIVED_AT_SHOP', 'PICKED_UP', 'ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER', 'DELIVERED'].includes(saved?.status)) {
          await load(); window.dispatchEvent(new Event('sb:orders'));
          navigate(`/orders?order=${encodeURIComponent(order.id)}`);
          return;
        }
      } catch { /* Keep the review action available without repeating the POST. */ }
      setError(`${errorMessage(cause)} Refresh the order before trying again.`);
    } finally { writeLock.current = false; setBusy(false); }
  };

  const reject = async () => {
    if (writeLock.current || !reason.trim()) return;
    writeLock.current = true;
    setBusy(true); setError('');
    try {
      const result = await api.post(`/merchant/orders/${order.id}/reject`, { reason: reason.trim() });
      if (result?.status !== 'MERCHANT_REJECTED') throw new Error('The service did not confirm rejection.');
      await confirmState('MERCHANT_REJECTED');
      setRejecting(false); setReason('');
    } catch (cause) {
      setError(`${errorMessage(cause)} Refresh the order before trying again.`);
    } finally { writeLock.current = false; setBusy(false); }
  };

  const ageMinutes = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  return <aside className="new-order-alert" role="alertdialog" aria-labelledby="new-order-alert-title" aria-describedby="new-order-alert-copy">
    <div className="new-order-pulse" aria-hidden="true"><ReferenceIcon name="orders" /></div>
    <div className="new-order-content">
      <div className="new-order-heading">
        <div><span className="new-order-eyebrow">New order · action required</span><h2 id="new-order-alert-title">Order {order.orderNumber}</h2></div>
        <button type="button" className="new-order-close" aria-label={`Close alert for order ${order.orderNumber}`} onClick={closeAlert}><ReferenceIcon name="close" /></button>
      </div>
      <p id="new-order-alert-copy">{order.customer?.user?.fullName || 'A customer'} · {itemCount} item{itemCount === 1 ? '' : 's'} · <strong>{pkr(order.totalAmountPaisa)}</strong></p>
      <ul className="new-order-items">{order.items.slice(0, 3).map((item) => <li key={item.id}><span>{item.quantity} × {item.productNameSnapshot}</span><b>{pkr(item.totalPricePaisa)}</b></li>)}</ul>
      {order.items.length > 3 && <small>+{order.items.length - 3} more item lines</small>}
      <div className="new-order-meta"><span>{ageMinutes < 1 ? 'Received just now' : `Waiting ${ageMinutes} min`}</span><span>{visible.length > 1 ? `${visible.length - 1} more pending` : 'Respond to keep the order moving'}</span></div>
      {error && <ToastMessage>{error}</ToastMessage>}
      {rejecting && <div className="new-order-reject"><label htmlFor="persistent-order-reason">Reason for rejecting</label><textarea id="persistent-order-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: item unavailable or shop closing" /><div className="row"><button type="button" className="btn danger" disabled={busy || !reason.trim()} onClick={() => void reject()}>{busy ? 'Confirming…' : 'Confirm rejection'}</button><button type="button" className="btn" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button></div></div>}
      {!rejecting && <div className="new-order-actions"><button type="button" className="btn" onClick={() => navigate(`/orders?order=${encodeURIComponent(order.id)}`)}>Review details</button><button type="button" className="btn danger" disabled={busy} onClick={() => setRejecting(true)}>Reject</button><button type="button" className="btn primary" disabled={busy} onClick={() => void accept()}>{busy ? 'Accepting…' : 'Accept order'}</button></div>}
    </div>
  </aside>;
}
