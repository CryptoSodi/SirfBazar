'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { check, main } = require('./healthcheck.cjs');

function fixture(url, options = {}, changes = {}) {
  const endpoint = new URL(url);
  if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': changes.badCors ? '*' : options.headers.Origin,
    'Access-Control-Allow-Credentials': 'true',
  } });
  let body;
  if (endpoint.pathname === '/ready') body = { ready: !changes.whatsappOffline };
  else if (endpoint.pathname === '/docs-json') body = { paths: changes.missingQuote ? {} : {
    '/api/orders/quote': { post: {} }, '/api/merchant/products/bulk-preview': { post: {} },
  } };
  else if (endpoint.pathname === '/api/products/categories') body = changes.emptyCatalog ? [] : [{ id: 'fixture' }];
  else if (endpoint.pathname === '/api/products/catalog') body = { items: [{ imageUrl: '/static/catalog/test.jpg' }], total: 1 };
  else if (endpoint.pathname.startsWith('/static/')) return new Response('image-fixture', { headers: { 'Content-Type': 'image/jpeg' } });
  else body = { items: [] };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

test('health checks use only GET and OPTIONS and do not log WhatsApp credentials', async () => {
  const previousFetch = global.fetch;
  const previousEnvironment = { ...process.env };
  const calls = [];
  try {
    process.env.OTP_PROVIDER = 'whatsapp';
    process.env.WHATSAPP_API_KEY = 'fixture-only-private-key';
    process.env.WHATSAPP_API_BASE_URL = 'https://otp.example.test';
    global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return fixture(url, options); };
    await main();
    assert.ok(calls.length > 10);
    assert.ok(calls.every(call => ['GET', 'OPTIONS'].includes(call.options.method || 'GET')));
    const auth = calls.filter(call => call.options.headers?.Authorization);
    assert.equal(auth.length, 1);
    assert.equal(auth[0].url, 'https://otp.example.test/ready');
    assert.ok(!calls.some(call => /send-message|send-otp/.test(call.url) && call.options.method !== 'OPTIONS'));
  } finally {
    global.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnvironment)) delete process.env[key];
    Object.assign(process.env, previousEnvironment);
  }
});

for (const [name, changes] of [['missing quote route', { missingQuote: true }], ['wrong CORS origin', { badCors: true }], ['empty categories', { emptyCatalog: true }]]) {
  test(`rejects ${name}`, async () => {
    const previous = global.fetch;
    global.fetch = async (url, options) => fixture(url, options, changes);
    try { await assert.rejects(check('https://api.example.test')); } finally { global.fetch = previous; }
  });
}

test('an offline WhatsApp provider blocks promotion without sending a message', async () => {
  const previousFetch = global.fetch;
  const previousEnvironment = { ...process.env };
  try {
    process.env.OTP_PROVIDER = 'whatsapp';
    process.env.WHATSAPP_API_KEY = 'fixture-only-private-key';
    process.env.WHATSAPP_API_BASE_URL = 'https://otp.example.test';
    global.fetch = async (url, options) => fixture(url, options, { whatsappOffline: true });
    await assert.rejects(main());
  } finally {
    global.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnvironment)) delete process.env[key];
    Object.assign(process.env, previousEnvironment);
  }
});
