'use strict';
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');

async function request(url, options = {}) {
  return fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4000), ...options });
}

async function check(base) {
  const categories = await request(`${base}/api/products/categories`);
  assert.equal(categories.status, 200);
  const tree = await categories.json();
  assert.ok(Array.isArray(tree) && tree.length > 0);
  const products = await request(`${base}/api/products/catalog?pageSize=1`);
  assert.equal(products.status, 200);
  const catalog = await products.json();
  assert.ok(Array.isArray(catalog.items) && catalog.items.length > 0 && catalog.total > 0);
  const image = catalog.items.find(product => product.imageUrl?.startsWith('/static/'))?.imageUrl;
  if (image) {
    const response = await request(new URL(image, base));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith('image/'));
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  for (const route of ['/api/products/nearby?latitude=31.5826&longitude=74.3276&pageSize=1',
    '/api/merchants/nearby?latitude=31.5826&longitude=74.3276', '/api/coupons']) {
    const response = await request(`${base}${route}`);
    assert.equal(response.status, 200);
    assert.ok(await response.json());
  }
  const docsResponse = await request(`${base}/docs-json`);
  assert.equal(docsResponse.status, 200);
  const docs = await docsResponse.json();
  assert.ok(docs.paths['/api/orders/quote']?.post);
  assert.ok(docs.paths['/api/merchant/products/bulk-preview']?.post);
  for (const origin of ['https://www.sirfbazar.com', 'https://pos.sirfbazar.com']) {
    const cors = await request(`${base}/api/auth/send-otp`, {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization' },
    });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get('access-control-allow-origin'), origin);
    assert.equal(cors.headers.get('access-control-allow-credentials'), 'true');
  }
}

async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await request('http://127.0.0.1:3002/api/products/categories', { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* Allow only the API's restart readiness window. */ }
    await sleep(1000);
  }
  assert.ok(ready);
  await check('http://127.0.0.1:3002');
  await check('https://api.sirfbazar.com');
  assert.equal(process.env.OTP_PROVIDER, 'whatsapp');
  const provider = new URL(process.env.WHATSAPP_API_BASE_URL || 'http://otp.sirfbazar.com');
  assert.ok(['http:', 'https:'].includes(provider.protocol));
  assert.ok(!provider.username && !provider.password && !provider.search && !provider.hash && provider.pathname === '/');
  assert.ok(process.env.WHATSAPP_API_KEY && !/\s/.test(process.env.WHATSAPP_API_KEY));
  const whatsapp = await request(new URL('/ready', provider), {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` },
  });
  assert.equal(whatsapp.status, 200);
  assert.equal((await whatsapp.json()).ready, true);
  console.log(JSON.stringify({ localApi: true, publicApi: true, quoteRoutes: true, cors: true, whatsappReady: true }));
}

if (require.main === module) main().catch(() => {
  console.error('Read-only API health checks failed; no OTP, order or payment was sent.');
  process.exitCode = 1;
});
module.exports = { check, main };
