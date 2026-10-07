const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness(api = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/product-purchase.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (name) => { assert.equal(name, './api'); return api; } });
  return module.exports;
}
const flow = harness();
const product = { id: 'milk', isRestricted: false, requiresPrescription: false };
const basket = () => ({ id: 'cart-a', itemCount: 2, groups: [{ items: [{ id: 'item-a', merchantProductId: 'mp-milk', quantity: 2 }] }] });
test('only explicit unrestricted, non-prescription detail flags permit adding', () => {
  assert.equal(flow.productPurchaseProblem(product, 'milk'), null);
  for (const detail of [null, {}, { id: 'milk' }, { ...product, id: 'other' },
    { ...product, isRestricted: true }, { ...product, requiresPrescription: true },
    { ...product, isRestricted: undefined }, { ...product, requiresPrescription: null },
    { ...product, isRestricted: 'false' }, { ...product, requiresPrescription: 0 }]) {
    assert.ok(flow.productPurchaseProblem(detail, 'milk'));
  }
});
test('purchase gate reads actual product detail without needing a fabricated location', async () => {
  const calls = [];
  const gate = harness({ api: { get: async (path) => { calls.push(path); return { ...product, id: 'milk /one' }; } } });
  await gate.assertProductCanBeAdded('milk /one');
  assert.deepEqual(calls, ['/products/milk%20%2Fone']);
});
test('missing ID, failed policy read and restricted detail fail before caller mutation', async () => {
  let writes = 0;
  for (const result of [undefined, { ...product, requiresPrescription: true }, new Error('offline')]) {
    const gate = harness({ api: { get: async () => { if (result instanceof Error) throw result; return result; } } });
    await assert.rejects(async () => { await gate.assertProductCanBeAdded('milk'); writes++; });
  }
  await assert.rejects(flow.assertProductCanBeAdded(''));
  assert.equal(writes, 0);
});
test('a basket check reflects actual server quantity or confirmed absence', () => {
  assert.equal(flow.basketItemSnapshot(basket(), 'mp-milk').quantity, 2);
  assert.equal(flow.basketItemSnapshot(basket(), 'another'), null);
  assert.equal(flow.basketItemSnapshot({ id: 'empty', itemCount: 0, groups: [] }, 'mp-milk'), null);
});
test('malformed basket and duplicate or invalid target quantities cannot clear uncertainty', () => {
  for (const cart of [null, {}, { id: 'x', itemCount: 0 }, { id: 'x', itemCount: 1, groups: [{}] },
    { id: 'x', itemCount: 1, groups: [{ items: [{}] }] }, { ...basket(), itemCount: 3 },
    { ...basket(), groups: [{ items: [...basket().groups[0].items, ...basket().groups[0].items] }] },
    { ...basket(), groups: [{ items: [{ id: 'i', merchantProductId: 'mp-milk', quantity: -1 }] }] }]) {
    assert.throws(() => flow.basketItemSnapshot(cart, 'mp-milk'));
  }
});
test('reconciliation checks the original cart and cannot claim a different account basket', async () => {
  const gate = harness({ fetchCart: async () => basket() });
  assert.equal((await gate.readConfirmedBasketItem('mp-milk', 'cart-a')).item.quantity, 2);
  await assert.rejects(gate.readConfirmedBasketItem('mp-milk', 'cart-b'), /basket changed/);
  const offline = harness({ fetchCart: async () => { throw Error('offline'); } });
  await assert.rejects(offline.readConfirmedBasketItem('mp-milk', 'cart-a'), /offline/);
});
test('pending additive write keys isolate cart ownership and offer identity', () => {
  assert.notEqual(flow.pendingBasketAddKey('cart-a', 'milk'), flow.pendingBasketAddKey('cart-b', 'milk'));
  assert.notEqual(flow.pendingBasketAddKey('cart-a', 'milk'), flow.pendingBasketAddKey('cart-a', 'eggs'));
});

function addButtonHarness({ detail = product, read = async () => ({ id: 'cart-a', itemCount: 0, groups: [] }), post, badge } = {}) {
  const values = new Map(), calls = [], hooks = [];
  let cursor = 0, added = 0, effects = [];
  const endpoint = {
    get: async (path) => { calls.push(['GET', path]); return detail; },
    post: async (path, body) => { calls.push(['POST', path, body]); return post?.(); },
    put: async (path, body) => { calls.push(['PUT', path, body]); },
  };
  const purchase = harness({ api: endpoint, fetchCart: read });
  const react = {
    useRef: (initial) => { const slot = cursor++; return hooks[slot] ??= { current: initial }; },
    useState: (initial) => { const slot = cursor++; if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial;
      return [hooks[slot], (next) => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next; }]; },
    useEffect: (callback, dependencies) => { const slot = cursor++; const previous = hooks[slot];
      if (!previous || dependencies.some((value, index) => value !== previous[index])) effects.push(callback);
      hooks[slot] = dependencies; },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/AddButton.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: (name) => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react-native') return { ActivityIndicator: 'ActivityIndicator', Text: 'Text', TouchableOpacity: 'Button', View: 'View' };
    if (name === '@react-native-async-storage/async-storage') return { default: { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async (key) => values.delete(key) } };
    if (name === '../lib/api') return { api: endpoint, cartBase: async () => '/guest/cart' };
    if (name === '../lib/theme') return { useTheme: () => ({ colors: {} }) };
    if (name === '../lib/badges') return { refreshBadges: async () => {}, useBadges: () => ({ cartItems: badge ? { 'mp-milk': badge } : {} }) };
    if (name === '../lib/customer-events') return { subscribeCustomerEvent: () => () => {} };
    if (name === '../lib/product-purchase') return purchase;
    throw Error(`Unexpected import ${name}`);
  } });
  const render = () => { cursor = 0; effects = []; const tree = module.exports.AddButton({ productId: 'milk', merchantProductId: 'mp-milk', onAdded: () => added++ }); effects.forEach((run) => run()); return tree; };
  const find = (node, label) => {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.accessibilityLabel === label) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, label); if (result) return result; }
    return null;
  };
  return { render, find, values, calls, added: () => added };
}
test('Add component never posts restricted or unknown-policy products', async () => {
  for (const detail of [{ ...product, isRestricted: true }, { id: 'milk' }]) {
    const app = addButtonHarness({ detail });
    await app.find(app.render(), 'Add to basket').props.onPress();
    assert.equal(app.calls.filter(([method]) => method === 'POST').length, 0);
    assert.equal(app.values.size, 0);
  }
});
test('existing restricted item can decrease but cannot increase from the native control', async () => {
  const app = addButtonHarness({ detail: { ...product, requiresPrescription: true }, badge: { id: 'item-a', quantity: 2 }, read: async () => basket() });
  await app.find(app.render(), 'Increase quantity').props.onPress();
  assert.equal(app.calls.filter(([method]) => method === 'PUT').length, 0);
  await app.find(app.render(), 'Decrease quantity').props.onPress();
  const changes = app.calls.filter(([method]) => method === 'PUT');
  assert.equal(changes.length, 1); assert.equal(changes[0][2].quantity, 1);
});
test('ambiguous Add is not called successful, and a failed read exposes only Check basket', async () => {
  let sent = false, readable = false;
  const app = addButtonHarness({ post: async () => { sent = true; throw Error('Response lost'); }, read: async () => {
    if (!sent) return { id: 'cart-a', itemCount: 0, groups: [] };
    if (!readable) throw Error('Offline');
    return basket();
  } });
  await app.find(app.render(), 'Add to basket').props.onPress();
  assert.equal(app.calls.filter(([method]) => method === 'POST').length, 1);
  assert.equal(app.added(), 0); assert.equal(app.values.size, 1);
  assert.equal(app.find(app.render(), 'Add to basket'), null);
  const check = app.find(app.render(), 'Check basket'); assert.ok(check);
  readable = true; check.props.onPress(); await new Promise(setImmediate);
  assert.equal(app.calls.filter(([method]) => method === 'POST').length, 1);
  assert.equal(app.added(), 0); assert.equal(app.values.size, 0);
  assert.ok(app.find(app.render(), 'Increase quantity'));
});
test('persisted unconfirmed addition prevents a new POST after a control remount', async () => {
  const app = addButtonHarness();
  app.values.set(flow.pendingBasketAddKey('cart-a', 'mp-milk'), JSON.stringify({ cartId: 'cart-a' }));
  await app.find(app.render(), 'Add to basket').props.onPress();
  assert.equal(app.calls.filter(([method]) => method === 'POST').length, 0);
  assert.equal(app.values.size, 1); assert.ok(app.find(app.render(), 'Check basket'));
});
test('successful HTTP response without the item in the checked basket does not claim added', async () => {
  const app = addButtonHarness();
  await app.find(app.render(), 'Add to basket').props.onPress();
  assert.equal(app.calls.filter(([method]) => method === 'POST').length, 1);
  assert.equal(app.added(), 0); assert.equal(app.values.size, 0);
});
