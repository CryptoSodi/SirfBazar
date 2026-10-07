import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const asModule = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText).toString('base64')}`;

test('POS responses invalidate only the affected merchant caches after a confirmed sale', async () => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  let merchantId = 'shop-a';
  let responseStatus = 200;
  let productEvents = 0;
  const requests = [];
  const browser = new EventTarget();
  browser.setTimeout = setTimeout;
  browser.clearTimeout = clearTimeout;
  browser.addEventListener('sb:products', () => { productEvents++; });
  globalThis.window = browser;
  globalThis.localStorage = { getItem: (key) => key === 'sbs.user' ? JSON.stringify({ merchant: { id: merchantId } }) : null };
  globalThis.fetch = async (url, request) => {
    requests.push({ url, method: request.method });
    return new Response(JSON.stringify(responseStatus === 200 ? { id: 'fixture-sale' } : { message: 'Stock changed; review this bill.' }), {
      status: responseStatus, headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const memoryUrl = asModule(readFileSync(new URL('../src/lib/memoryCache.ts', import.meta.url), 'utf8'));
    const cache = await import(memoryUrl);
    const source = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
      .replace("'./memoryCache'", JSON.stringify(memoryUrl))
      .replaceAll('import.meta.env', '({ VITE_API_URL: "https://api.example.test/api" })');
    const { api } = await import(asModule(source));
    const seed = () => {
      for (const key of ['products:1', 'catalog:all', 'dashboard', 'orders:1', 'riders']) cache.writeMemory(key, 'last-confirmed');
    };
    merchantId = 'shop-b'; seed();
    merchantId = 'shop-a'; seed();

    responseStatus = 409;
    await assert.rejects(api.post('/pos/sales', { requestId: 'fixture-sale' }), /Stock changed/);
    assert.equal(cache.readMemory('products:1'), 'last-confirmed');
    assert.equal(cache.readMemory('dashboard'), 'last-confirmed');
    assert.equal(productEvents, 0, 'a rejected sale must not announce an inventory change');

    responseStatus = 200;
    await api.post('/pos/products/review', { merchantProductIds: ['fixture-product'] });
    assert.equal(cache.readMemory('products:1'), 'last-confirmed');
    assert.equal(productEvents, 0, 'reviewing prices is not a stock mutation');

    await api.post('/pos/sales', { requestId: 'fixture-sale' });
    for (const key of ['products:1', 'catalog:all', 'dashboard']) assert.equal(cache.readMemory(key), undefined, key);
    assert.equal(cache.readMemory('orders:1'), 'last-confirmed');
    assert.equal(cache.readMemory('riders'), 'last-confirmed');
    assert.equal(productEvents, 1);
    merchantId = 'shop-b';
    assert.equal(cache.readMemory('products:1'), 'last-confirmed', 'another merchant cache remains isolated');
    assert.equal(requests.length, 3, 'a rejected financial request is not automatically replayed');
    assert.ok(requests.every(({ url, method }) => url.startsWith('https://api.example.test/api/pos/') && method === 'POST'));
    cache.clearMemory();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
