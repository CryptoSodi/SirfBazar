const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const data = new Map();
const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/sale-recovery.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: loaded, exports: loaded.exports, localStorage: {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key),
} });
const flow = loaded.exports;
const saved = { version: 1, owner: 'cashier-a', merchantId: 'shop-a', payload: {
  requestId: '1b87bc45-166a-420a-ad66-967a7b39559c', amountTenderedPaisa: 50000,
  items: [{ merchantProductId: 'milk', quantity: 2, expectedUnitPricePaisa: 20000 }],
} };
const receipt = { id: saved.payload.requestId, merchantId: 'shop-a', cashierId: 'cashier-a', totalAmountPaisa: 40000,
  amountTenderedPaisa: 50000, items: [{ merchantProductId: 'milk', quantity: 2, unitPricePaisa: 20000 }] };

test('pending cash sale persists exact identity and cannot be replayed by another cashier', () => {
  flow.saveSaleRecovery(saved);
  assert.equal(flow.readSaleRecovery('cashier-a').payload.requestId, saved.payload.requestId);
  assert.equal(flow.readSaleRecovery('cashier-b'), null);
  assert.throws(() => flow.saveSaleRecovery({ ...saved, payload: { ...saved.payload, requestId: 'new-id' } }), /status check/);
  flow.clearSaleRecovery(saved);
  assert.equal(data.size, 0);
});
test('receipt recovery validates merchant, cashier, amount, quantity and reviewed unit prices', () => {
  assert.equal(flow.receiptMatches(saved, receipt), true);
  for (const altered of [{ merchantId: 'other' }, { cashierId: 'other' }, { totalAmountPaisa: 42000 },
    { amountTenderedPaisa: 40000 }, { items: [{ ...receipt.items[0], quantity: 1 }] },
    { items: [{ ...receipt.items[0], unitPricePaisa: 21000 }] }]) {
    assert.equal(flow.receiptMatches(saved, { ...receipt, ...altered }), false);
  }
});
test('only definitive POST rejection releases a saved sale for bill review', () => {
  for (const status of [undefined, 0, 401, 408, 409, 500]) assert.equal(flow.isDefinitiveSaleRejection(status), false);
  for (const status of [400, 403, 422]) assert.equal(flow.isDefinitiveSaleRejection(status), true);
});
