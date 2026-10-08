import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_URL, api, captureSession, errorMessage, sessionIsCurrent } from '../lib/api';
import { disableWebPush, enableWebPush, webPushState, type WebPushState } from '../lib/webPush';
import { ReferenceIcon } from './ReferenceIcon';
import { InlineSkeleton } from './Skeleton';
import { memoryScope, readMemory, writeMemory } from '../lib/memoryCache';

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  audience?: string;
  scopeId?: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
};

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Just now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export function NotificationBell() {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const cachedNotifications = readMemory<Notification[]>('notifications');
  const [items, setItems] = useState<Notification[]>(cachedNotifications ?? []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(!cachedNotifications);
  const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState<WebPushState>('disabled');
  const [scope, setScope] = useState<'current' | 'legacy'>('current');
  const scopeRef = useRef(scope);
  const [sessionRevision, setSessionRevision] = useState(0);

  useEffect(() => {
    const changed = () => {
      scopeRef.current = 'current'; setItems([]); setOpen(false); setLoading(true); setError(''); setScope('current');
      setPushStatus('disabled'); setSessionRevision((value) => value + 1);
    };
    window.addEventListener('sb:session', changed);
    return () => window.removeEventListener('sb:session', changed);
  }, []);

  const refresh = useCallback(async () => {
    const captured = captureSession();
    const cacheScope = memoryScope();
    const query = scope === 'legacy' ? '?scope=legacy' : '';
    try {
      const response = await api.get(`/notifications${query}`);
      if (!sessionIsCurrent(captured) || cacheScope !== memoryScope() || scopeRef.current !== scope) return;
      if (!Array.isArray(response)) throw new Error('The notifications response is invalid.');
      setItems(response);
      if (scope === 'current') writeMemory('notifications', response, cacheScope);
      setError('');
    } catch (cause) {
      if (sessionIsCurrent(captured) && scopeRef.current === scope) setError(errorMessage(cause));
    } finally {
      if (sessionIsCurrent(captured) && scopeRef.current === scope) setLoading(false);
    }
  }, [scope, sessionRevision]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('sb:notifications', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('sb:notifications', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    const captured = captureSession();
    void webPushState().then((next) => { if (sessionIsCurrent(captured)) setPushStatus(next); }).catch(() => { if (sessionIsCurrent(captured)) setPushStatus('disabled'); });
  }, [sessionRevision]);

  useEffect(() => {
    const onPushOpen = (event: MessageEvent) => {
      if (event.data?.type !== 'sb:push-open') return;
      const current = captureSession();
      const shopId = current.user?.merchant?.id ?? current.user?.staffOf?.find?.((staff: any) => staff.status === 'ACTIVE')?.merchantId;
      if (!current.access || !(
        (event.data.audience === 'MERCHANT' && event.data.scopeId === shopId) ||
        (event.data.audience === 'ACCOUNT' && event.data.scopeId === current.user?.id))) return;
      const target = new URL(event.data.url || '/workspace', window.location.origin);
      if (target.origin !== window.location.origin) return;
      navigate(target.pathname === '/orders' ? '/orders' : '/workspace');
    };
    navigator.serviceWorker?.addEventListener('message', onPushOpen);
    return () => navigator.serviceWorker?.removeEventListener('message', onPushOpen);
  }, [navigate]);

  useEffect(() => {
    const captured = captureSession();
    const token = captured.access;
    if (!token || !API_URL) return;
    // Start with Socket.IO's polling transport and upgrade to WebSocket after the
    // authenticated connection is established. This is more reliable across
    // local proxies and avoids a noisy failed-WebSocket race during page reloads.
    const socket = io(new URL(API_URL).origin, { auth: { token } });
    const notify = (notification?: Notification) => {
      if (!sessionIsCurrent(captured) || scopeRef.current !== scope) return;
      const shopId = captured.user?.merchant?.id ?? captured.user?.staffOf?.find?.((staff: any) => staff.status === 'ACTIVE')?.merchantId;
      if (notification && notification.audience && !(
        (notification.audience === 'MERCHANT' && notification.scopeId === shopId) ||
        (notification.audience === 'ACCOUNT' && notification.scopeId === captured.user?.id))) return;
      void refresh();
      window.dispatchEvent(new Event('sb:orders'));
      if (notification && pushStatus !== 'subscribed' && document.hidden && window.Notification?.permission === 'granted') {
        new window.Notification(notification.title, { body: notification.body, tag: notification.id });
      }
    };
    socket.on('notification', notify);
    socket.on('order:new', () => notify());
    socket.on('order:update', () => notify());
    socket.on('rider:presence', () => { if (sessionIsCurrent(captured)) window.dispatchEvent(new Event('sb:riders')); });
    socket.on('connect', () => {
      if (!sessionIsCurrent(captured)) { socket.disconnect(); return; }
      const merchantId = captured.user?.merchant?.id;
      if (merchantId) socket.emit('join:merchant', { merchantId });
    });
    return () => { socket.disconnect(); };
  }, [pushStatus, refresh, sessionRevision]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = items.filter((item) => !item.isRead).length;
  const badgeUnread = scope === 'current' ? unread : 0;

  const enableDesktopAlerts = async () => {
    const captured = captureSession();
    try {
      const next = await enableWebPush();
      if (!sessionIsCurrent(captured)) return;
      setPushStatus(next);
      if (next === 'unsupported') setError('This browser does not support background notifications.');
      else if (next === 'disabled') setError('Background notifications are not configured on the merchant service.');
      else if (next !== 'subscribed') setError('Notification permission was not granted.');
      else setError('');
    } catch (cause) {
      if (sessionIsCurrent(captured)) setError(errorMessage(cause));
    }
  };

  const disableDesktopAlerts = async () => {
    const captured = captureSession();
    try {
      await disableWebPush();
      if (!sessionIsCurrent(captured)) return;
      setPushStatus('permission-needed');
      setError('');
    } catch (cause) {
      if (sessionIsCurrent(captured)) setError(errorMessage(cause));
    }
  };

  const markAllRead = async () => {
    const captured = captureSession();
    const cacheScope = memoryScope();
    try {
      await api.post(`/notifications/read-all${scope === 'legacy' ? '?scope=legacy' : ''}`);
      if (!sessionIsCurrent(captured)) return;
      setItems((current) => scope === 'current' ? writeMemory('notifications', current.map((item) => ({ ...item, isRead: true })), cacheScope) : current.map((item) => ({ ...item, isRead: true })));
      setError('');
    } catch (cause) {
      if (sessionIsCurrent(captured)) setError(errorMessage(cause));
    }
  };

  const openItem = async (item: Notification) => {
    const captured = captureSession();
    const cacheScope = memoryScope();
    if (!item.isRead) {
      try {
        await api.post(`/notifications/${encodeURIComponent(item.id)}/read${scope === 'legacy' ? '?scope=legacy' : ''}`);
        if (!sessionIsCurrent(captured) || scopeRef.current !== scope) return;
        setItems((current) => scope === 'current' ? writeMemory('notifications', current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate), cacheScope) : current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate));
      } catch (cause) {
        if (sessionIsCurrent(captured)) setError(errorMessage(cause));
        return;
      }
    }
    if (!sessionIsCurrent(captured)) return;
    setOpen(false);
    if (item.referenceId && item.type.toUpperCase().includes('ORDER')) navigate('/orders');
  };

  return <div className="notification-root" ref={root}>
    <button
      type="button"
      className={`icon-btn notify-dot ${badgeUnread > 0 ? 'has-unread' : ''}`}
      aria-label={badgeUnread ? `Notifications, ${badgeUnread} unread` : 'Notifications'}
      aria-expanded={open}
      aria-controls="merchant-notifications"
      onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }}
    >
      <ReferenceIcon name="bell" />
      {badgeUnread > 0 && <span className="notification-count" aria-hidden="true">{badgeUnread > 9 ? '9+' : badgeUnread}</span>}
    </button>
    {open && <section id="merchant-notifications" className="notification-popover" aria-label="Notifications">
      <div className="notification-head">
        <div><h2>Notifications</h2><p>{unread ? `${unread} unread` : 'You are all caught up'}</p></div>
        <div className="row">{pushStatus === 'permission-needed' && <button type="button" className="btn subtle tiny" onClick={() => void enableDesktopAlerts()}>Enable alerts</button>}{pushStatus === 'subscribed' && <button type="button" className="btn subtle tiny" onClick={() => void disableDesktopAlerts()}>Disable alerts</button>}{unread > 0 && <button type="button" className="btn subtle tiny" onClick={() => void markAllRead()}>Mark all read</button>}</div>
      </div>
      <div className="row" role="group" aria-label="Notification history"><button type="button" className="btn subtle tiny" aria-pressed={scope === 'current'} onClick={() => { scopeRef.current = 'current'; setScope('current'); setItems([]); setLoading(true); }}>Current shop</button><button type="button" className="btn subtle tiny" aria-pressed={scope === 'legacy'} onClick={() => { scopeRef.current = 'legacy'; setScope('legacy'); setItems([]); setLoading(true); }}>Earlier account history</button></div>
      <div className="notification-list" aria-live="polite">
        {loading && <InlineSkeleton label="Loading notifications" rows={3} />}
        {!loading && error && <div className="notification-state error"><p>{error}</p><button className="btn tiny" type="button" onClick={() => void refresh()}>Retry</button></div>}
        {!loading && !error && items.length === 0 && <div className="notification-state"><ReferenceIcon name="bell" size="lg" /><p>No notifications yet.</p></div>}
        {!loading && !error && items.slice(0, 20).map((item) => <button
          type="button"
          className={`notification-item ${item.isRead ? '' : 'unread'}`}
          key={item.id}
          onClick={() => void openItem(item)}
        >
          <span className="notification-item-icon"><ReferenceIcon name={item.type.toUpperCase().includes('ORDER') ? 'orders' : 'bell'} /></span>
          <span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{relativeTime(item.createdAt)}</small></span>
          {!item.isRead && <span className="notification-unread" aria-label="Unread" />}
        </button>)}
      </div>
    </section>}
  </div>;
}
