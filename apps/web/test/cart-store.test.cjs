const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  let cart = { groups: [{ items: [{ id: 'cart-item', merchantProductId: 'offer-a', quantity: 2, stockQuantity: 5 }] }] };
  let failUpdate = false;
  const calls = [];
  const listeners = new Map();
  const api = {
    captureSession: () => ({ identity: 'guest' }),
    fetchCart: async () => structuredClone(cart),
    addToCart: async (id, quantity) => {
      calls.push(['add', id, quantity]);
      cart = { groups: [{ items: [{ id: 'cart-item', merchantProductId: id, quantity, stockQuantity: 5 }] }] };
      return structuredClone(cart);
    },
    updateCartItem: async (_itemId, quantity) => {
      calls.push(['update', quantity]);
      if (failUpdate) { failUpdate = false; throw new Error('Stock changed. Review your basket.'); }
      cart = { groups: [{ items: quantity ? [{ id: 'cart-item', merchantProductId: 'offer-a', quantity, stockQuantity: 5 }] : [] }] };
      return structuredClone(cart);
    },
  };
  const react = { useSyncExternalStore: (subscribe, getSnapshot) => { subscribe(() => {}); return getSnapshot(); } };
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../lib/cart-store.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => name === 'react' ? react : name === './api' ? api : (() => { throw Error(name); })(), window: { addEventListener: (name, callback) => listeners.set(name, callback) }, Map, Set, Promise, Number, Math });
  const store = module.exports;
  const current = (id = 'offer-a', cap = 5, available = true) => store.useCartQuantity(id, cap, available);
  return { current, calls, listeners, setFailUpdate: value => { failUpdate = value; }, getCart: () => cart };
}

const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

test('quantity reads the real cart, updates reactively, and enforces stock limits', async () => {
  const f = fixture();
  f.current();
  await settle();
  assert.equal(f.current().quantity, 2);
  assert.equal(f.current('offer-a', 2).canIncrement, false);
  f.current().change(3);
  assert.equal(f.current().quantity, 3, 'quantity updates optimistically across subscribers');
  await settle();
  assert.equal(f.current().quantity, 3);
  assert.deepEqual(f.calls, [['update', 3]]);
});

test('quantity reaching zero removes the item, and a later add uses the same server cart identity', async () => {
  const f = fixture();
  f.current(); await settle();
  f.current().change(0); await settle();
  assert.equal(f.current().quantity, 0);
  f.current().change(1); await settle();
  assert.equal(f.current().quantity, 1);
  assert.deepEqual(f.calls, [['update', 0], ['add', 'offer-a', 1]]);
});

test('failed quantity mutations reconcile from the server and surface an inline error', async () => {
  const f = fixture();
  f.current(); await settle();
  f.setFailUpdate(true);
  f.current().change(4);
  assert.equal(f.current().quantity, 4);
  await settle();
  assert.equal(f.current().quantity, 2);
  assert.match(f.current().error, /Stock changed/);
});
