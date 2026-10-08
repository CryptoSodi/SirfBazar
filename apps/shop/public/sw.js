self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || 'SirfBazar Merchant';
  const options = {
    body: payload.body || 'You have a new merchant update.',
    tag: payload.tag || 'sirfbazar-merchant',
    icon: '/brand/sirfbazar-app-icon-green.svg',
    badge: '/brand/sirfbazar-app-icon-green.svg',
    data: { ...(payload.data || {}), audience: payload.audience, scopeId: payload.scopeId, url: payload.data?.url || '/workspace' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const context = event.notification.data || {};
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'sb:push-open', audience: context.audience, scopeId: context.scopeId, url: context.url });
      return;
    }
    // A new tab has no authenticated context yet. Open a neutral route only.
    await self.clients.openWindow('/workspace');
  })());
});
