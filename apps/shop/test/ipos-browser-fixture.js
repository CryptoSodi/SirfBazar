// playwright-cli run-code --filename apps/shop/test/ipos-browser-fixture.js
// All API requests are intercepted. This fixture never contacts a live API.
async (page) => {
  const products = [
    ['milk', 'Fresh milk', '1 litre', '0012345', 29000, 12],
    ['eggs', 'Farm eggs', '6 pack', '0123456', 24000, 24],
    ['rice', 'Basmati rice', '1 kg', '0234567', 35000, 18],
    ['bread', 'Whole wheat bread', 'loaf', '0345678', 19000, 9],
    ['tea', 'Family tea', '190 g', '0456789', 42000, 0],
  ].map(([id, name, unit, barcode, pricePaisa, stockQuantity]) => ({ merchantProductId: id, productId: `product-${id}`, name, unit, barcode, merchantSku: `SKU-${id}`, pricePaisa, stockQuantity, isAvailable: true }));
  const profile = { id: 'ipos-test-shop', shopName: 'Market Lane Grocers', isOwner: false, permissions: ['POS'], isOnline: true, isOpen: true, approvalStatus: 'APPROVED' };
  const user = { id: 'ipos-test-cashier', fullName: 'Test cashier', merchant: { id: profile.id, shopName: profile.shopName } };
  const sales = new Map();
  let dropNext = false;
  let capabilitiesMode = 'supported';
  // The merged merchant shell starts notification polling and Socket.IO. Keep
  // every API request inside this fixture, including shell requests. Block
  // every other origin so a future shell dependency cannot reach a live host.
  await page.context().route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:5184') return route.continue();
    return route.abort();
  });
  await page.context().route('**/socket.io/**', route => route.abort());
  if (page.context().routeWebSocket) await page.context().routeWebSocket('**/socket.io/**', socket => socket.close());
  await page.context().route('**/api/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace(/^\/api/, '');
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return send({});
    if (path === '/auth/me') return send(user);
    if (path === '/merchant/profile') return send(profile);
    if (path === '/notifications') return send([]);
    if (path === '/merchant/orders') return send([]);
    if (path === '/__fixture/capabilities') { capabilitiesMode = url.searchParams.get('mode') || 'supported'; return send({ mode: capabilitiesMode }); }
    if (path === '/pos/capabilities' && capabilitiesMode === 'unsupported') return send({ message: 'POS is unavailable on this API.' }, 404);
    if (path === '/pos/capabilities' && capabilitiesMode === 'error') return send({ message: 'Service temporarily unavailable.' }, 503);
    if (path === '/pos/capabilities') return send({ version: 2, merchantId: profile.id, idempotentSales: true, barcodeLookup: true, paymentMethods: ['CASH'], offlineSales: false });
    if (path === '/__fixture/drop-next') { dropNext = true; return send({ armed: true }); }
    if (path === '/__fixture/stats') return send({ sales: sales.size });
    if (path === '/pos/products/lookup') {
      const product = products.find(p => p.barcode === url.searchParams.get('code') || p.merchantSku === url.searchParams.get('code'));
      return product ? send(product) : send({ message: 'No product matches this barcode or SKU.' }, 404);
    }
    if (path === '/pos/products/review') return send(products.filter(p => request.postDataJSON().merchantProductIds.includes(p.merchantProductId)));
    if (path === '/pos/products') { const q = (url.searchParams.get('q') || '').toLowerCase(); return send(products.filter(p => `${p.name} ${p.barcode} ${p.merchantSku}`.toLowerCase().includes(q))); }
    if (path === '/pos/sales' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      if (!sales.has(payload.requestId)) {
        const items = payload.items.map(line => { const product = products.find(p => p.merchantProductId === line.merchantProductId); return { productNameSnapshot: product.name, quantity: line.quantity, unitPricePaisa: product.pricePaisa, totalPricePaisa: line.quantity * product.pricePaisa, unitSnapshot: product.unit }; });
        const totalAmountPaisa = items.reduce((sum, line) => sum + line.totalPricePaisa, 0);
        const sale = { id: payload.requestId, orderNumber: `POS-TEST-${sales.size + 1}`, createdAt: new Date().toISOString(), totalAmountPaisa, items, amountTenderedPaisa: payload.amountTenderedPaisa, changePaisa: payload.amountTenderedPaisa - totalAmountPaisa, counterName: payload.counterName, merchant: { shopName: profile.shopName, address: 'Test data only — not a real sale' } };
        sales.set(payload.requestId, sale);
        payload.items.forEach(line => { products.find(p => p.merchantProductId === line.merchantProductId).stockQuantity -= line.quantity; });
      }
      if (dropNext) { dropNext = false; return route.abort('failed'); }
      return send(sales.get(payload.requestId));
    }
    if (path === '/pos/sales') return send({ sales: [...sales.values()].reverse() });
    if (path.startsWith('/pos/sales/')) { const sale = sales.get(path.split('/').pop()); return sale ? send(sale) : send({ message: 'Receipt not found' }, 404); }
    return send({ message: `Unmocked route: ${path}` }, 404);
  });
  await page.context().addInitScript(({ user }) => {
    if (localStorage.getItem('sb.fixture.authDisabled') === 'true') {
      localStorage.removeItem('sbs.accessToken');
      localStorage.removeItem('sbs.refreshToken');
      localStorage.removeItem('sbs.user');
      return;
    }
    localStorage.setItem('sbs.accessToken', `test.${btoa(JSON.stringify({ role: 'MERCHANT_STAFF' }))}.test`);
    localStorage.setItem('sbs.refreshToken', 'test-only');
    localStorage.setItem('sbs.user', JSON.stringify(user));
  }, { user });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5184/ipos');
}
