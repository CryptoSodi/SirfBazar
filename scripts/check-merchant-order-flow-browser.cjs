const assert = require('node:assert/strict');

module.exports = async (page, baseUrl) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) throw Error('Order fixtures require a local preview.');
  const context = page.context();
  const profile = { id: 'flow-shop', shopName: 'Workflow fixture', isOwner: true, permissions: ['ORDERS', 'RIDERS'], isOnline: true, isOpen: true, approvalStatus: 'APPROVED' };
  const user = { id: 'flow-owner', fullName: 'Fixture Owner', status: 'ACTIVE', merchant: { id: profile.id } };
  const rider = { id: 'rider-1', fullName: 'Available fixture rider', phoneNumber: '03000000000', vehicleType: 'MOTORBIKE', isOnline: true, isActive: true, approvalStatus: 'APPROVED', currentStatus: 'IDLE', currentOrderId: null };
  const initial = () => ({ id: 'flow-order', orderNumber: 'SB-FLOW-FIXTURE', status: 'SENT_TO_MERCHANT', createdAt: new Date().toISOString(), totalAmountPaisa: 12000, subtotalPaisa: 10000, deliveryFeePaisa: 2000, items: [{ id: 'item', quantity: 1, productNameSnapshot: 'Fixture milk', totalPricePaisa: 10000 }], customer: { user: { fullName: 'Fixture buyer' } }, deliveryAddress: { fullAddress: 'Fixture address', city: 'Lahore' }, rider: null, timeline: [] });
  let order = initial(), riderMode = 'available', loseResponse = false, failRead = false, posts = [];
  const json = data => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  await context.addInitScript(({ user }) => {
    localStorage.setItem('sbs.accessToken', `fixture.${btoa(JSON.stringify({ role: 'MERCHANT_OWNER', exp: 4102444800 }))}.fixture`);
    localStorage.setItem('sbs.user', JSON.stringify(user));
    localStorage.setItem('sirfbazar.merchant.theme', 'light');
  }, { user });
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
    if (path === '/auth/me') return route.fulfill(json(user));
    if (path === '/merchant/profile') return route.fulfill(json(profile));
    if (path === '/merchant/riders') {
      if (riderMode === 'failure') return route.fulfill({ ...json({ message: 'Connection interrupted. Try again.' }), status: 503 });
      return route.fulfill(json(riderMode === 'empty' ? [] : [rider, { ...rider, id: 'busy', fullName: 'Busy fixture rider', currentStatus: 'ASSIGNED', currentOrderId: 'other' }]));
    }
    if (path === '/merchant/orders') {
      const rows = url.searchParams.get('status') && url.searchParams.get('status') !== order.status ? [] : [order];
      return route.fulfill(json(url.searchParams.has('page') ? { items: rows, total: rows.length, page: Number(url.searchParams.get('page')), pageSize: 20, totalPages: 1 } : rows));
    }
    if (path === '/merchant/orders/flow-order') {
      if (failRead) return route.fulfill({ ...json({ message: 'Connection interrupted. Try again.' }), status: 503 });
      return route.fulfill(json(order));
    }
    if (route.request().method() === 'POST' && path.startsWith('/merchant/orders/flow-order/')) {
      const action = path.split('/').pop(); posts.push(action);
      if (action === 'accept') { order.status = 'PREPARING'; order.timeline.push({ id: 'accept', status: 'MERCHANT_ACCEPTED', createdAt: order.createdAt }, { id: 'prepare', status: 'PREPARING', createdAt: order.createdAt }); }
      else if (action === 'assign-rider') { assert.equal(route.request().postDataJSON().riderId, rider.id); order.rider = { ...rider }; }
      else if (action === 'ready') order.status = order.rider ? 'RIDER_ASSIGNED' : 'READY_FOR_PICKUP';
      else throw Error(`Unexpected fixture mutation: ${action}`);
      if (loseResponse) { loseResponse = false; return route.abort(); }
      return route.fulfill(json({ ok: true, status: order.status, rider: order.rider }));
    }
    if (route.request().method() !== 'GET') throw Error(`Unexpected fixture write: ${path}`);
    return route.fulfill(json([]));
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) return route.fallback();
    return ['localhost', '127.0.0.1'].includes(url.hostname) && !url.pathname.startsWith('/socket.io/') ? route.continue() : route.abort();
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', ws => ws.close());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/orders`);
  const view = page.getByRole('button', { name: 'View order SB-FLOW-FIXTURE', exact: true });
  await view.click();
  let drawer = page.getByRole('dialog', { name: 'Order SB-FLOW-FIXTURE', exact: true });
  await drawer.getByRole('button', { name: 'Accept order', exact: true }).focus();
  await page.keyboard.press('Enter');
  await drawer.getByLabel('Delivery rider').waitFor();
  assert.equal(await drawer.getByRole('button', { name: 'Start preparing', exact: true }).count(), 0);
  assert.deepEqual(posts, ['accept']);
  assert.equal(await drawer.getByLabel('Delivery rider').locator('option').count(), 2, 'busy riders are excluded');
  await drawer.getByLabel('Delivery rider').focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await drawer.getByRole('button', { name: 'Assign rider', exact: true }).focus();
  await page.keyboard.press('Enter');
  await drawer.getByText('Assigned rider · waiting for packing', { exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.order-workflow button')].every(node => !node.disabled));
  await drawer.getByRole('button', { name: 'Mark ready for pickup' }).evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
  assert.equal(order.status, 'PREPARING'); assert.deepEqual(posts, ['accept', 'assign-rider']);
  assert.equal(await page.getByRole('dialog').count(), 1, 'assignment has no second modal/confirmation');
  const ratios = [];
  for (const width of [1280, 640, 320]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; }, theme);
    assert.ok(await drawer.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'sidebar reflows without horizontal overflow');
    const measurements = await drawer.locator('.order-workflow h3,.order-workflow p,.order-workflow strong,.order-workflow button,.order-workflow a,.order-details [class*="text-slate-"]').evaluateAll(nodes => {
      const lum = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
      return nodes.map(node => { let parent = node; while (parent.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(parent).backgroundColor)) parent = parent.parentElement; const a = lum(getComputedStyle(node).color), b = lum(getComputedStyle(parent).backgroundColor); return { text: node.textContent, color: getComputedStyle(node).color, background: getComputedStyle(parent).backgroundColor, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }; });
    });
    ratios.push(...measurements.map(m => m.ratio));
    if (measurements.some(m => m.ratio < 4.5)) { await page.screenshot({ path: 'output/playwright/merchant-order-flow-contrast-failure.png' }); throw Error(JSON.stringify({ width, theme, failures: measurements.filter(m => m.ratio < 4.5) })); }
    if (width !== 640) await page.screenshot({ path: `output/playwright/merchant-order-flow-${width}-${theme}.png` });
  }
  await drawer.getByRole('button', { name: 'Mark ready for pickup' }).click();
  await drawer.getByText(/can confirm pickup in the rider app/).waitFor();
  assert.equal(order.status, 'RIDER_ASSIGNED');
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  assert.equal(await view.evaluate(node => node === document.activeElement), true, 'Escape restores order-row focus');
  // A lost assignment response is reconciled by GET, never POSTed again.
  order = { ...initial(), status: 'PREPARING' }; loseResponse = true;
  await page.goto(`${baseUrl}/orders?order=flow-order`);
  drawer = page.getByRole('dialog', { name: 'Order SB-FLOW-FIXTURE', exact: true });
  await drawer.getByLabel('Delivery rider').selectOption('rider-1');
  await drawer.getByRole('button', { name: 'Assign rider', exact: true }).click();
  await drawer.getByText('Assigned rider · waiting for packing', { exact: true }).waitFor();
  assert.equal(posts.filter(a => a === 'assign-rider').length, 2, 'one assignment POST per user attempt despite lost response');
  await drawer.getByRole('button', { name: 'Mark ready for pickup' }).waitFor({ state: 'visible' });
  // Empty and failed rider lists offer recovery in the same sidebar.
  order = { ...initial(), status: 'PREPARING' }; riderMode = 'empty';
  await page.goto(`${baseUrl}/orders?order=flow-order`);
  await drawer.getByText('No riders available', { exact: true }).waitFor();
  assert.equal(await drawer.getByRole('link', { name: 'Manage riders', exact: true }).getAttribute('href'), '/riders');
  riderMode = 'failure';
  await drawer.getByRole('button', { name: 'Refresh riders', exact: true }).click();
  await drawer.getByRole('button', { name: 'Retry riders', exact: true }).waitFor();
  riderMode = 'available';
  await drawer.getByRole('button', { name: 'Retry riders', exact: true }).click();
  await drawer.getByLabel('Delivery rider').selectOption('rider-1');
  loseResponse = true; failRead = true;
  await drawer.getByRole('button', { name: 'Assign rider', exact: true }).click();
  await drawer.getByRole('button', { name: 'Check saved order', exact: true }).waitFor();
  assert.equal(await drawer.getByRole('button', { name: 'Mark ready for pickup' }).isDisabled(), true, 'uncertain outcome blocks further writes');
  failRead = false;
  await drawer.getByRole('button', { name: 'Check saved order', exact: true }).click();
  await drawer.getByText('Assigned rider · waiting for packing', { exact: true }).waitFor();
  profile.isOwner = false; profile.permissions = ['ORDERS'];
  order = { ...initial(), status: 'PREPARING' };
  await page.goto(`${baseUrl}/orders?order=flow-order`);
  await drawer.getByText('Ask the shop owner to assign a rider. Rider-management permission is required.', { exact: true }).waitFor();
  assert.equal(await drawer.getByLabel('Delivery rider').count(), 0, 'staff without rider permission cannot select a rider');
  assert.equal(await drawer.getByRole('button', { name: 'Assign rider', exact: true }).count(), 0);
  // Accepting from the persistent alert also opens inline dispatch, even after a lost response.
  profile.isOwner = true; profile.permissions = ['ORDERS', 'RIDERS'];
  order = initial(); loseResponse = true;
  await page.goto(`${baseUrl}/`);
  const alert = page.getByRole('alertdialog', { name: 'Order SB-FLOW-FIXTURE', exact: true });
  await alert.getByRole('button', { name: 'Accept order', exact: true }).click();
  await page.waitForURL('**/orders?order=flow-order');
  await drawer.getByLabel('Delivery rider').waitFor();
  assert.equal(order.status, 'PREPARING');
  assert.equal(posts.filter(action => action === 'accept').length, 2, 'one accept per user attempt, with no POST retry after a lost response');
  return { passed: true, minimumTextContrast: Math.min(...ratios), actions: posts, viewports: [1280, 640, 320], themes: ['light', 'dark'] };
};
