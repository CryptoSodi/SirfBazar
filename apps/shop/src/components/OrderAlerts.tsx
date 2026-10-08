import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { io } from 'socket.io-client';
import { api, API_URL, captureSession, getAccessToken, sessionIsCurrent } from '../lib/api';
import { readOrders } from '../lib/merchant-contracts';
import { applyOrderEvent, claimSoundLease, readOrderEvent, realtimeOrigin, type PendingOrder } from '../lib/order-alerts';

type Connection = 'connecting' | 'live' | 'fallback' | 'offline';

/** Mounted in the shell, so orders alert on every merchant page. */
export default function OrderAlerts({ merchantId }: { merchantId: string }) {
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [syncError, setSyncError] = useState(false);
  const [sound, setSound] = useState(false);
  const [soundError, setSoundError] = useState('');
  const [desktop, setDesktop] = useState<NotificationPermission | 'unsupported'>(
    () => 'Notification' in window ? Notification.permission : 'unsupported');
  const [desktopError, setDesktopError] = useState('');
  const [sessionRevision, setSessionRevision] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const pendingRef = useRef(pending);
  const tabId = useRef('');
  if (!tabId.current) tabId.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const leaseKey = `sbs.order-sound.${merchantId}`;
  pendingRef.current = pending;

  useEffect(() => {
    const captured = captureSession();
    const current = () => sessionIsCurrent(captured);
    let active = true;
    let joined = false;
    let syncing = false;
    let syncAgain = false;
    let revision = 0;
    let lastSync = 0;
    let lastToken = getAccessToken();
    let notices = new Set<string>();
    let joinTimer: number | undefined;
    const socket = io(realtimeOrigin(API_URL), {
      autoConnect: false,
      auth: callback => callback({ token: current() ? getAccessToken() : '' }),
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      timeout: 8_000,
    });
    const changed = () => window.dispatchEvent(new Event('sb:orders-changed'));
    const announce = (orders: PendingOrder[]) => {
      if (!current()) return;
      for (const order of orders) {
        if (notices.has(order.id)) continue;
        notices.add(order.id);
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const notice = new Notification('New SirfBazar order', {
              body: `Order ${order.orderNumber} is waiting for your decision.`,
              tag: `sirfbazar-order-${order.id}`, silent: true,
            });
            notice.onclick = () => { if (current()) { window.focus(); window.location.assign(`/orders?order=${encodeURIComponent(order.id)}`); } notice.close(); };
          } catch { /* In-app alerts remain available if OS notifications fail. */ }
        }
      }
    };
    const sync = async () => {
      if (!active || !current()) return;
      if (syncing) { syncAgain = true; return; }
      syncing = true;
      const before = revision;
      try {
        const orders = readOrders(await api.get('/merchant/orders?status=SENT_TO_MERCHANT'));
        if (!active || !current()) return;
        // A late snapshot must not undo a new order/acceptance received live.
        if (revision !== before) { syncAgain = true; return; }
        const next = orders.map(({ id, orderNumber }) => ({ id, orderNumber }));
        announce(next);
        setPending(next);
        setSyncError(false);
        lastSync = Date.now();
        changed();
      } catch {
        if (active && current()) setSyncError(true); // Keep known orders on a transient failure.
      } finally {
        syncing = false;
        if (active && syncAgain) { syncAgain = false; void sync(); }
      }
    };
    const join = () => {
      if (!active || !current() || !socket.connected) return;
      socket.timeout(5_000).emit('join:merchant', { merchantId }, (error: Error | null, reply: { ok?: boolean } | undefined) => {
        if (!active || !current() || !socket.connected) return;
        if (error || reply?.ok !== true) {
          joined = false;
          setConnection('fallback');
          // REST renews an expired session; sb:session then reauthenticates socket.
          void api.get('/auth/me').catch(() => {});
          joinTimer = window.setTimeout(join, 5_000);
          return;
        }
        joined = true;
        setConnection('live');
        void sync(); // Recover pending orders missed during disconnection.
      });
    };
    const orderEvent = (value: unknown) => {
      if (!joined || !current()) return;
      const event = readOrderEvent(value);
      if (!event) return;
      revision++;
      if (!event.status || event.status === 'SENT_TO_MERCHANT') announce([{ id: event.orderId, orderNumber: event.orderNumber }]);
      setPending(current => applyOrderEvent(current, event));
      changed();
      // Confirm canonical state too: an announcement may arrive after an
      // order was already accepted on another device.
      void sync();
    };
    socket.on('connect', join);
    socket.on('order:new', orderEvent);
    socket.on('order:update', orderEvent);
    socket.on('notification', (value: { type?: string }) => {
      // Personal notifications can refer to another staff shop: reconcile via
      // the tenant-scoped endpoint instead of trusting their referenceId.
      if (current() && value?.type === 'NEW_ORDER') void sync();
    });
    const disconnected = () => {
      if (!current()) return;
      joined = false;
      window.clearTimeout(joinTimer);
      setConnection(navigator.onLine ? 'fallback' : 'offline');
    };
    socket.on('disconnect', disconnected);
    socket.on('connect_error', disconnected);
    const session = () => {
      if (!current()) { setPending([]); setSessionRevision((value) => value + 1); return; }
      const token = getAccessToken();
      if (token === lastToken) return;
      lastToken = token;
      joined = false;
      window.clearTimeout(joinTimer);
      socket.disconnect();
      if (token) { setConnection('connecting'); socket.connect(); }
    };
    const online = () => { if (!current()) return; if (!socket.connected) socket.connect(); void sync(); };
    const visible = () => {
      if (!document.hidden) {
        setDesktop('Notification' in window ? Notification.permission : 'unsupported');
        online();
      }
    };
    window.addEventListener('sb:session', session);
    window.addEventListener('online', online);
    window.addEventListener('offline', disconnected);
    window.addEventListener('sb:orders-reconcile', sync);
    document.addEventListener('visibilitychange', visible);
    // Fallback only: the normal path is server events, even in a hidden tab.
    const timer = window.setInterval(() => {
      // Socket.IO does not retry a server-rejected handshake automatically.
      if (!socket.connected && !socket.active && navigator.onLine && getAccessToken()) socket.connect();
      if (!joined || Date.now() - lastSync > 60_000) void sync();
    }, 5_000);
    socket.connect();
    void sync();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(joinTimer);
      socket.disconnect();
      window.removeEventListener('sb:session', session);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('sb:orders-reconcile', sync);
      document.removeEventListener('visibilitychange', visible);
      notices.clear();
    };
  }, [merchantId, sessionRevision]);

  const playTone = () => {
    const context = audio.current;
    if (!context || context.state !== 'running') {
      setSound(false);
      setSoundError('Sound is paused. Select Enable sound to resume alerts.');
      return;
    }
    // A short, recognisable three-note chime; no remote asset dependency.
    [880, 1174.66, 880].forEach((frequency, index) => {
      const start = context.currentTime + index * 0.22;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.21);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  };
  const enableSound = async () => {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      if (audio.current.state !== 'running') throw new Error('paused');
      setSoundError('');
      setSound(true);
      if (!pendingRef.current.length) playTone();
    } catch { setSoundError('Unable to play sound. Allow sound for this site, then try Enable sound again.'); }
  };
  const pendingIds = pending.map(order => order.id).sort().join(',');
  useEffect(() => {
    if (!sound || !pendingIds) return;
    const ring = () => { if (claimSoundLease(localStorage, leaseKey, tabId.current, Date.now())) playTone(); };
    ring();
    const timer = window.setInterval(ring, 10_000);
    return () => window.clearInterval(timer);
  }, [sound, pendingIds, leaseKey]);
  useEffect(() => () => {
    void audio.current?.close();
    audio.current = null;
    try {
      if (JSON.parse(localStorage.getItem(leaseKey) || 'null')?.tabId === tabId.current) localStorage.removeItem(leaseKey);
    } catch { /* no storage */ }
  }, [leaseKey]);

  const enableDesktop = async () => {
    try { setDesktop(await Notification.requestPermission()); setDesktopError(''); }
    catch { setDesktopError('Unable to enable desktop alerts. Allow notifications in your browser’s site settings.'); }
  };
  const label = connection === 'live' ? 'Live order alerts' : connection === 'connecting' ? 'Connecting order alerts…' :
    connection === 'offline' ? 'Offline — reconnect to receive orders' : 'Reconnecting — checking orders every 5 seconds';

  return <section className="ops-order-alerts" aria-label="Order alerts">
    <div className="ops-order-alerts-row">
      <div className="ops-order-alerts-status"><Bell size={18} aria-hidden="true" /><span>{label}</span></div>
      <div className="ops-order-alerts-controls">
        <button type="button" className="ops-button" onClick={() => sound ? setSound(false) : void enableSound()} aria-pressed={sound}>
          {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}{sound ? 'Mute sound' : 'Enable sound'}
        </button>
        {sound && <button type="button" className="ops-button" onClick={playTone}>Test sound</button>}
        {desktop === 'default' && <button type="button" className="ops-button" onClick={() => void enableDesktop()}>Enable desktop alerts</button>}
      </div>
    </div>
    <p className="ops-order-alerts-note">Keep this portal open. Sound repeats every 10 seconds until new orders are accepted or rejected, or you mute it.</p>
    {desktop === 'denied' && <p className="ops-order-alerts-note">Desktop alerts are blocked. Allow notifications in your browser’s site settings to enable pop-ups.</p>}
    {desktop === 'granted' && <p className="ops-order-alerts-note">Desktop alerts enabled.</p>}
    {desktopError && <p className="ops-order-alerts-error" role="alert">{desktopError}</p>}
    {soundError && <p className="ops-order-alerts-error" role="alert">{soundError}</p>}
    {syncError && <div className="ops-order-alerts-error">Unable to check pending orders. Check your connection. <button type="button" className="ops-button" onClick={() => window.dispatchEvent(new Event('sb:orders-reconcile'))}>Retry order check</button></div>}
    <div role="status" aria-live="polite" aria-atomic="true" className={pending.length ? 'ops-order-alerts-pending' : ''}>
      {pending.length > 0 && <><div><strong>{pending.length === 1 ? '1 new order needs a decision' : `${pending.length} new orders need a decision`}</strong><p>{pending.map(order => order.orderNumber).join(' · ')}</p></div><Link className="ops-button ops-button-primary" to={pending.length === 1 ? `/orders?order=${encodeURIComponent(pending[0].id)}` : '/orders?status=SENT_TO_MERCHANT'}>Review {pending.length === 1 ? 'order' : 'orders'}</Link></>}
    </div>
  </section>;
}
