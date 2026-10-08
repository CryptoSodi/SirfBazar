import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { api, API_URL, getAccessToken, getAuthVersion, renewSession } from './api';
import { publishCustomerEvent, subscribeCustomerEvent } from './customer-events';

let socket: Socket | null = null;
let token: string | null = null;
let syncing = false;
let syncAgain = false;
const watched = new Map<string, number>();
export function isRealtimeConnected() {
  return !!socket?.connected;
}
export function watchOrders(ids: string[]) {
  ids.forEach((id) => {
    watched.set(id, (watched.get(id) ?? 0) + 1);
    if (socket?.connected) socket.emit('join:order', { orderId: id });
  });
  return () =>
    ids.forEach((id) => {
      const remaining = (watched.get(id) ?? 1) - 1;
      if (remaining) watched.set(id, remaining);
      else watched.delete(id);
    });
}
export function startCustomerRealtime() {
  let stopped = false;
  const invalidate = () => {
    publishCustomerEvent('orders');
    publishCustomerEvent('notifications');
    publishCustomerEvent('support');
  };
  const sync = async () => {
    const generation = getAuthVersion();
    if (syncing) {
      syncAgain = true;
      return;
    }
    syncing = true;
    try {
      const next = await getAccessToken();
      if (stopped || generation !== getAuthVersion()) return;
      if (!next || AppState.currentState !== 'active') {
        socket?.disconnect();
        socket = null;
        token = null;
        return;
      }
      if (next === token && socket?.connected) return;
      // REST refresh validates the current app role before any new handshake.
      await api.get('/auth/me');
      const fresh = await getAccessToken();
      if (!fresh || stopped || generation !== getAuthVersion()) return;
      socket?.disconnect();
      token = fresh;
      const connectedSocket = io(API_URL.replace(/\/api\/?$/, ''), {
        auth: (done) => done({ token: generation === getAuthVersion() ? fresh : '' }),
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });
      socket = connectedSocket;
      const current = () => !stopped && socket === connectedSocket && generation === getAuthVersion();
      socket.on('connect', () => {
        if (!current()) { connectedSocket.disconnect(); return; }
        watched.forEach((_, orderId) => connectedSocket.emit('join:order', { orderId }));
        invalidate(); // Recover missed messages from canonical REST data.
      });
      socket.on('order:update', () => { if (current()) publishCustomerEvent('orders'); });
      socket.on('rider:location', () => { if (current()) publishCustomerEvent('orders'); });
      socket.on('notification', () => { if (current()) invalidate(); });
    } catch {
      /* Screens retain polling and their last confirmed data. */
    } finally {
      syncing = false;
      if (syncAgain && !stopped) {
        syncAgain = false;
        void sync();
      }
    }
  };
  void sync();
  const unsubscribe = subscribeCustomerEvent('auth', () => {
    socket?.disconnect();
    socket = null;
    token = null;
    void sync();
  });
  const state = AppState.addEventListener('change', () => {
    void sync();
    invalidate();
  });
  const retry = setInterval(() => void sync(), 5000);
  // JWTs last 15 minutes. Renew while active; reconnect with the rotated token.
  const renewal = setInterval(
    () => {
      if (AppState.currentState === 'active' && token)
        void renewSession()
          .then(sync)
          .catch(() => undefined);
    },
    9 * 60 * 1000,
  );
  return () => {
    stopped = true;
    unsubscribe();
    state.remove();
    clearInterval(retry);
    clearInterval(renewal);
    socket?.disconnect();
    socket = null;
    token = null;
  };
}
