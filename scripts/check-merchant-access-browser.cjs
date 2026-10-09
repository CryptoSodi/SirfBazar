const assert = require('node:assert/strict');
module.exports = async (page, url) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw Error('Admin fixtures require a local preview.');
  const context = page.context();
  const shop = { id: 'saas-shop', shopName: 'SaaS fixture shop', shopType: 'GROCERY', city: 'Lahore', approvalStatus: 'APPROVED', isOnline: true, isOpen: true, commissionType: 'PERCENTAGE', commissionValue: 5, serviceRadiusKm: 5, user: { fullName: 'Fixture owner' }, _count: { orders: 0 }, trial: { endsAt: '2026-11-09T00:00:00Z', accessContinuesAfterTrial: true } };
  const writes = [];
  let loseResponse = false;
  await context.addInitScript(() => { localStorage.setItem('sba.accessToken', 'fixture-only-admin'); localStorage.setItem('sba.user', JSON.stringify({ id: 'fixture-admin', role: 'ADMIN' })); });
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const json = data => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/admin/merchants' && route.request().method() === 'GET') return route.fulfill(json({ items: [shop], total: 1, page: 1, pageSize: 20, totalPages: 1 }));
    if (path === '/admin/merchants/saas-shop') return route.fulfill(json(shop));
    if (route.request().method() === 'POST') {
      assert.ok(['/admin/merchants/saas-shop/suspend', '/admin/merchants/saas-shop/reactivate'].includes(path));
      writes.push(path);
      shop.approvalStatus = path.endsWith('/suspend') ? 'SUSPENDED' : 'APPROVED'; shop.isOnline = shop.approvalStatus === 'APPROVED';
      if (loseResponse) { loseResponse = false; return route.abort(); }
      return route.fulfill(json({ ok: true, approvalStatus: shop.approvalStatus }));
    }
    assert.equal(route.request().method(), 'GET', 'no unrecognized admin mutation');
    return route.fulfill(json([]));
  });
  await context.route('**/*', route => { const u = new URL(route.request().url()); if (u.pathname.startsWith('/api/')) return route.fallback(); return ['localhost', '127.0.0.1'].includes(u.hostname) ? route.continue() : route.abort(); });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', ws => ws.close());
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url + '/merchants');
    await page.getByRole('button', { name: 'Manage', exact: true }).click();
    const modal = page.getByRole('dialog', { name: shop.shopName, exact: true });
    await modal.getByRole('heading', { name: 'One-month trial · no automatic lockout' }).waitFor();
    assert.ok(await modal.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'admin modal reflows at narrow widths');
    await modal.getByRole('button', { name: 'Disable shop', exact: true }).focus(); await page.keyboard.press('Enter');
    await modal.getByRole('heading', { name: 'Disable SaaS fixture shop?' }).waitFor();
    const targets = await modal.locator('.merchant-access-modal button').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
    assert.ok(targets.length > 0 && targets.every(target => target.height >= 44), 'shop-access controls provide 44px touch targets');
    assert.equal(writes.length, width === 1280 ? 0 : 2, 'opening confirmation never disables a shop');
    await modal.getByLabel('Reason (optional)').fill('Disposable UI check');
    await page.screenshot({ path: `output/playwright/admin-merchant-access-${width}.png` });
    await modal.getByRole('button', { name: 'Confirm disable', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(shop.approvalStatus, 'SUSPENDED'); assert.equal(shop.isOnline, false);
    await page.getByRole('button', { name: 'Manage', exact: true }).click();
    await modal.getByRole('button', { name: 'Reactivate shop', exact: true }).waitFor();
    loseResponse = true;
    await modal.getByRole('button', { name: 'Reactivate shop', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(shop.approvalStatus, 'APPROVED'); assert.equal(shop.trial.endsAt, '2026-11-09T00:00:00Z');
  }
  assert.equal(writes.length, 4, 'lost response reconciles saved state without repeating the access write');
  return { passed: true, adminAccessMutations: writes.length, viewports: [1280, 320] };
};
