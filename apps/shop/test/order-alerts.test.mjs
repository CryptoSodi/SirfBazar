import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/order-alerts.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { applyOrderEvent, readOrderEvent, realtimeOrigin, claimSoundLease } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('new order events are deduplicated and acceptance/cancellation clear their alert', () => {
  const event = { orderId: 'shop-order-1', orderNumber: 'SB-1' };
  const pending = applyOrderEvent([], event);
  assert.equal(pending.length, 1);
  assert.equal(applyOrderEvent(pending, event), pending);
  assert.equal(applyOrderEvent(pending, { ...event, status: 'SENT_TO_MERCHANT' }), pending);
  for (const status of ['MERCHANT_ACCEPTED', 'PREPARING', 'CANCELLED_BY_CUSTOMER', 'MERCHANT_REJECTED']) {
    assert.deepEqual(applyOrderEvent(pending, { ...event, status }), []);
  }
  assert.deepEqual(applyOrderEvent(pending, { orderId: 'other', orderNumber: 'SB-2', status: 'DELIVERED' }), pending);
});

test('malformed live events never create an alert', () => {
  for (const event of [null, {}, { orderId: 3 }, { orderId: 'x', orderNumber: '' }, { orderId: 'x', orderNumber: 'SB-X', status: 123 }]) {
    assert.equal(readOrderEvent(event), null);
  }
  assert.deepEqual(readOrderEvent({ orderId: 'x', orderNumber: 'SB-X' }), { orderId: 'x', orderNumber: 'SB-X' });
});

test('socket uses API origin rather than incorrectly connecting to /api namespace', () => {
  assert.equal(realtimeOrigin('http://localhost:3001/api'), 'http://localhost:3001');
  assert.equal(realtimeOrigin('https://api.example.com/api/'), 'https://api.example.com');
  for (const url of ['invalid', 'file:///api', 'https://api.example.com/other', 'https://api.example.com/api?token=x']) {
    assert.throws(() => realtimeOrigin(url));
  }
});

test('only one merchant tab rings, and another takes over after its lease expires', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(claimSoundLease(storage, 'shop-A', 'tab-1', 0), true);
  assert.equal(claimSoundLease(storage, 'shop-A', 'tab-2', 1), false);
  assert.equal(claimSoundLease(storage, 'shop-A', 'tab-1', 10_000), true);
  assert.equal(claimSoundLease(storage, 'shop-B', 'tab-2', 10_001), true);
  assert.equal(claimSoundLease(storage, 'shop-A', 'tab-2', 22_001), true);
  assert.equal(claimSoundLease({ getItem: () => { throw Error('blocked'); } }, 'shop-A', 'tab-1', 0), true);
});
