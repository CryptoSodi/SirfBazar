import { api, captureSession, sessionIsCurrent } from './api';

function decodeApplicationServerKey(value: string) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`;
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function encodeApplicationServerKey(value: ArrayBuffer | null) {
  if (!value) return '';
  const binary = String.fromCharCode(...new Uint8Array(value));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type WebPushState = 'unsupported' | 'disabled' | 'permission-needed' | 'subscribed';

async function activeServiceWorker() {
  await navigator.serviceWorker.register('/sw.js');
  // register() can resolve while a first-time worker is still installing. PushManager
  // rejects subscriptions until the registration has an active worker.
  return navigator.serviceWorker.ready;
}

export async function webPushState(): Promise<WebPushState> {
  const captured = captureSession();
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const config = await api.get('/notifications/web-push/config');
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  if (!config?.enabled || !config.publicKey) return 'disabled';
  if (Notification.permission !== 'granted') return 'permission-needed';
  const registration = await activeServiceWorker();
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  const existing = await registration.pushManager.getSubscription();
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  if (existing && encodeApplicationServerKey(existing.options.applicationServerKey) === config.publicKey) return 'subscribed';
  return 'permission-needed';
}

export async function enableWebPush(): Promise<WebPushState> {
  const captured = captureSession();
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const config = await api.get('/notifications/web-push/config');
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  if (!config?.enabled || !config.publicKey) return 'disabled';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  if (permission !== 'granted') return 'permission-needed';

  const registration = await activeServiceWorker();
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  let subscription = await registration.pushManager.getSubscription();
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  if (subscription && encodeApplicationServerKey(subscription.options.applicationServerKey) !== config.publicKey) {
    const oldEndpoint = subscription.endpoint;
    await subscription.unsubscribe();
    if (!sessionIsCurrent(captured)) return 'permission-needed';
    await api.post('/notifications/web-push/unsubscribe', { endpoint: oldEndpoint }).catch(() => undefined);
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(config.publicKey),
  });
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) throw new Error('The browser returned an incomplete push subscription.');
  await api.post('/notifications/web-push/subscribe', {
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
  });
  if (!sessionIsCurrent(captured)) return 'permission-needed';
  return 'subscribed';
}

export async function disableWebPush(): Promise<void> {
  const captured = captureSession();
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!sessionIsCurrent(captured)) return;
  const subscription = await registration?.pushManager.getSubscription();
  if (!sessionIsCurrent(captured)) return;
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  if (!sessionIsCurrent(captured)) return;
  await api.post('/notifications/web-push/unsubscribe', { endpoint });
}
