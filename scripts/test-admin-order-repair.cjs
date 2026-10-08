const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/admin/node_modules/typescript');
const exportsForTest = {};
const source = fs.readFileSync(path.join(__dirname, '../apps/admin/src/lib/order-repair.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText, { exports: exportsForTest });
const options = order => Array.from(exportsForTest.orderRepairOptions(order));
const base = { channel: 'ONLINE', status: 'MERCHANT_ACCEPTED', paymentMethod: 'COD', paymentStatus: 'CASH_PENDING' };
const paid = { ...base, paymentMethod: 'CARD', paymentStatus: 'PAID', payments: [{ status: 'PAID', providerTransactionId: 'verified-provider-id' }] };

test('eligible COD and provider-confirmed prepaid orders have the same forward repairs', () => {
  assert.deepEqual(options(base), ['PREPARING', 'READY_FOR_PICKUP']);
  assert.deepEqual(options(paid), options(base));
});
test('prepaid repair requires collected evidence from the correct payment owner', () => {
  for (const changes of [
    { payments: [] }, { payments: [{ status: 'PAID', providerTransactionId: null }] },
    { payments: [{ status: 'PAYMENT_PENDING', providerTransactionId: 'reference-only' }] },
    { paymentStatus: 'PAYMENT_PENDING' }, { paymentStatus: 'REFUNDED' }, { paymentMethod: undefined },
    { parentOrderId: 'parent', parent: null },
    { parentOrderId: 'parent', parent: { payments: [] } },
  ]) assert.deepEqual(options({ ...paid, ...changes }), []);
  assert.deepEqual(options({ ...paid, parentOrderId: 'parent', payments: [], parent: { payments: paid.payments } }), options(base));
});
test('cash payment evidence cannot authorize prepaid repair, or a collected COD order', () => {
  assert.deepEqual(options({ ...paid, payments: [{ status: 'CASH_COLLECTED', providerTransactionId: 'cash' }] }), []);
  assert.deepEqual(options({ ...base, paymentStatus: 'CASH_COLLECTED' }), []);
});
test('rider, pickup, parent and non-online evidence suppress repair', () => {
  for (const changes of [
    { channel: 'POS' }, { isParent: true }, { riderId: 'rider' }, { pickedUpAt: '2026-10-09' },
    ...['PICKED_UP', 'ON_THE_WAY', 'RIDER_ARRIVED_AT_CUSTOMER'].map(status => ({ timeline: [{ status }] })),
  ]) assert.deepEqual(options({ ...paid, ...changes }), []);
});
test('only allowed forward statuses appear; pending replacements prevent pickup but not preparation', () => {
  assert.deepEqual(options({ ...paid, status: 'SENT_TO_MERCHANT' }), ['MERCHANT_ACCEPTED']);
  assert.deepEqual(options({ ...paid, status: 'PREPARING' }), ['READY_FOR_PICKUP']);
  for (const status of ['DELIVERED', 'CANCELLED_BY_ADMIN', 'RIDER_ASSIGNED', 'READY_FOR_PICKUP']) {
    assert.deepEqual(options({ ...paid, status }), []);
  }
  assert.deepEqual(options({ ...paid, items: [{ itemStatus: 'REPLACEMENT_SUGGESTED' }] }), ['PREPARING']);
  assert.deepEqual(options({ ...paid, status: 'PREPARING', items: [{ itemStatus: 'REPLACEMENT_SUGGESTED' }] }), []);
});
