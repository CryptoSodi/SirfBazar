const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const flow = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/rider-orders.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: flow });
test('reserved preparing deliveries remain visible but are waiting for packing', () => {
  for (const status of ['MERCHANT_ACCEPTED', 'PREPARING']) {
    assert.equal(flow.isActive(status), true); assert.equal(flow.waitingForPacking(status), true);
  }
  for (const status of ['RIDER_ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED_BY_ADMIN']) assert.equal(flow.waitingForPacking(status), false);
  assert.equal(flow.isActive('DELIVERED'), false); assert.equal(flow.isActive('CANCELLED_BY_ADMIN'), false);
});
