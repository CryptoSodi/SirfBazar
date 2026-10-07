const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(failWrite = false) {
  const data = new Map();
  const module = { exports: {} };
  const source = fs.readFileSync(require.resolve('../lib/checkout-recovery.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => { if (failWrite) throw Error('Storage unavailable'); data.set(key, value); },
      removeItem: (key) => data.delete(key),
    } });
  return { recovery: module.exports, data };
}
const record = (owner = 'customer-a') => ({ version: 1, owner, state: 'pending', payload: {
  requestId: 'bcbbe7d8-061b-4ef9-a67c-80b141ba10a5', cartId: 'cart-a', approvedQuote: 'signed-quote', deliveryAddressId: 'address-a', paymentMethod: 'COD',
} });

test('saved checkout survives reload and only original account can read or clear it', () => {
  const { recovery, data } = harness(); const saved = record();
  recovery.saveCheckoutRecovery(saved);
  assert.equal(recovery.readCheckoutRecovery('customer-a').payload.requestId, saved.payload.requestId);
  assert.equal(recovery.readCheckoutRecovery('customer-b'), null);
  recovery.clearCheckoutRecovery(record('customer-b'));
  assert.equal(data.size, 1);
  recovery.clearCheckoutRecovery(saved);
  assert.equal(data.size, 0);
});
test('pending checkout blocks a second identity and storage failure prevents submission', () => {
  const { recovery } = harness(); recovery.saveCheckoutRecovery(record());
  assert.throws(() => recovery.saveCheckoutRecovery({ ...record(), payload: { ...record().payload, requestId: 'another-id' } }), /status check/);
  assert.throws(() => harness(true).recovery.saveCheckoutRecovery(record()), /Storage unavailable/);
});
test('uncertain/auth/conflict results retain recovery; definitive no-write rejects release it', () => {
  const { isDefinitiveRejection, isDefinitiveNoWrite } = harness().recovery;
  for (const status of [undefined, 0, 401, 408, 409, 500]) assert.equal(isDefinitiveRejection(status), false);
  for (const status of [400, 403, 422]) assert.equal(isDefinitiveRejection(status), true);
  assert.equal(isDefinitiveNoWrite(409, 'QUOTE_CHANGED'), true);
  assert.equal(isDefinitiveNoWrite(409, 'QUOTE_REQUIRED'), false);
  assert.equal(isDefinitiveNoWrite(404), true); // only when returned by the saved POST; a GET 404 never calls this helper
  assert.equal(isDefinitiveNoWrite(undefined), false);
});
