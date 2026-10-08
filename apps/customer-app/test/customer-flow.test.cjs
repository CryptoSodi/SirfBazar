const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}, extras = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/' + file + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (name) => {
    if (!(name in dependencies)) throw Error('Unexpected dependency: ' + name);
    return dependencies[name];
  }, console, setTimeout, clearTimeout, AbortController, process, ...extras });
  return module.exports;
}
const flow = load('customer-flow');
test('nested category names resolve without losing the parent selection', () => {
  const { findCategoryName } = load('category-tree');
  const tree = [{ id: 'produce', name: 'Fruits & Vegetables', children: [{ id: 'fruit', name: 'Fresh Fruits' }, { id: 'veg', name: 'Fresh Vegetables' }] }];
  assert.equal(findCategoryName(tree, 'produce'), 'Fruits & Vegetables');
  assert.equal(findCategoryName(tree, 'veg'), 'Fresh Vegetables');
  assert.equal(findCategoryName(tree, 'missing'), undefined);
});
test('notification taps route only supported references', () => {
  assert.equal(flow.notificationDestination({ type: 'PROMOTION', referenceId: 'not-an-order' }), null);
  assert.equal(flow.notificationDestination({ type: 'ORDER_ACCEPTED', referenceId: 'order' }).orderId, 'order');
  assert.equal(flow.notificationDestination({ type: 'RIDER_ASSIGNED', referenceId: 'order' }).orderId, 'order');
  assert.equal(flow.notificationDestination({ type: 'SUPPORT_REPLY', referenceId: 'ticket' }).ticketId, 'ticket');
  assert.equal(flow.notificationDestination({ type: 'ORDER_ACCEPTED' }), null);
});
test('replacement responses use child order and original item IDs', () => {
  const child = { id: 'child', status: 'PREPARING', items: [
    { id: 'original', itemStatus: 'UNAVAILABLE' },
    { id: 'suggestion', replacementForItemId: 'original', itemStatus: 'REPLACEMENT_SUGGESTED' },
  ] };
  const pending = flow.pendingReplacements({ isParent: true, children: [child] });
  assert.equal(pending.length, 1); assert.equal(pending[0].orderId, 'child');
  assert.equal(pending[0].original.id, 'original');
  child.status = 'DELIVERED'; assert.equal(flow.pendingReplacements(child).length, 0);
});
test('stock/price checks and native local API resolution', () => {
  assert.equal(flow.cartIssues({ groups: [{ items: [{ inStock: false, priceChanged: true }] }] }).unavailable, true);
  assert.equal(flow.resolveApiUrl('http://localhost:3001/api', 'android', '192.168.1.7:8084'), 'http://192.168.1.7:3001/api');
  assert.equal(flow.resolveApiUrl('http://localhost:3001/api', 'web', '192.168.1.7:8084'), 'http://localhost:3001/api');
  assert.equal(flow.resolveApiUrl('https://api.sirfbazar.com/api', 'ios', '192.168.1.7:8084'), 'https://api.sirfbazar.com/api');
});
test('GPS deadline exits even if provider never replies', async () => {
  await assert.rejects(flow.withDeadline(new Promise(() => {}), 5, 'Pick manually'), /Pick manually/);
});
function apiHarness(fetcher) {
  const values = new Map([['sb.accessToken', 'expired'], ['sb.refreshToken', 'refresh']]);
  const storage = { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key), multiRemove: async (keys) => keys.forEach((key) => values.delete(key)) };
  const api = load('api', {
    '@react-native-async-storage/async-storage': { default: storage },
    './credentials': { readCredential: storage.getItem, writeCredential: storage.setItem, removeCredential: storage.removeItem },
    './customer-events': { publishCustomerEvent: () => {} },
    './customer-flow': flow, 'react-native': { Platform: { OS: 'web' } },
    'expo-constants': { default: { expoConfig: {} } },
    './push': { registerForPush: async () => true, unregisterPush: async () => {} },
  }, { fetch: fetcher });
  return { api, values };
}
const response = (status, body) => ({ ok: status < 400, status, json: async () => body });
test('an old refresh response cannot overwrite a new sign-in', async () => {
  let release, started;
  const ready = new Promise((resolve) => started = resolve);
  const pending = new Promise((resolve) => release = resolve);
  const { api, values } = apiHarness(async () => { started(); await pending; return response(200, {
    accessToken: 'old-refreshed', refreshToken: 'old-refresh', user: { id: 'old-user' },
  }); });
  const renewing = api.renewSession();
  await ready;
  await api.storeAuth({ accessToken: 'new-login', refreshToken: 'new-refresh', user: { id: 'new-user' } });
  release(); await assert.rejects(renewing, /session changed/);
  assert.equal(values.get('sb.accessToken'), 'new-login');
});
test('concurrent expired requests rotate refresh token once', async () => {
  let rotations = 0;
  const { api } = apiHarness(async (url, options) => {
    if (url.endsWith('/auth/refresh-token')) {
      rotations++; await new Promise((resolve) => setTimeout(resolve, 10));
      return response(200, { accessToken: 'fresh', refreshToken: 'rotated', user: { id: 'u' } });
    }
    return options.headers.authorization === 'Bearer fresh' ? response(200, { ok: true }) : response(401, {});
  });
  const result = await Promise.all([api.api.get('/customer/profile'), api.api.get('/customer/addresses')]);
  assert.equal(rotations, 1); assert.equal(result.every((entry) => entry.ok), true);
});
test('offline refresh keeps tokens instead of logging out', async () => {
  const { api, values } = apiHarness(async (url) => {
    if (url.endsWith('/auth/refresh-token')) throw Error('offline');
    return response(401, {});
  });
  await assert.rejects(api.api.get('/customer/profile'), /connection/);
  assert.equal(values.get('sb.refreshToken'), 'refresh');
});
test('failed guest merge remains pending and explicit retry clears it', async () => {
  let fail = true;
  const { api, values } = apiHarness(async (url) => {
    if (url.endsWith('/merge-after-login')) return response(fail ? 503 : 200, {});
    throw Error('Unexpected fetch');
  });
  values.set('sb.guestToken', 'guest');
  await assert.rejects(api.afterLogin({ accessToken: 'new', refreshToken: 'new-refresh', user: { id: 'u' } }));
  assert.equal(await api.hasPendingBasketMerge(), true); assert.equal(values.get('sb.guestToken'), 'guest');
  fail = false; await api.retryBasketMerge();
  assert.equal(await api.hasPendingBasketMerge(), false); assert.equal(values.has('sb.guestToken'), false);
});
test('native credential migration removes plaintext only after secure persistence', async () => {
  const plain = new Map([['token', 'old']]), secure = new Map();
  const credentials = load('credentials', {
    '@react-native-async-storage/async-storage': { default: {
      getItem: async (key) => plain.get(key) ?? null, removeItem: async (key) => plain.delete(key),
    } },
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': { getItemAsync: async (key) => secure.get(key) ?? null,
      setItemAsync: async (key, value) => secure.set(key, value), deleteItemAsync: async (key) => secure.delete(key) },
  });
  assert.equal(await credentials.readCredential('token'), 'old');
  assert.equal(plain.has('token'), false); assert.equal(secure.get('token'), 'old');
});
test('logout cannot be undone by an in-flight plaintext migration', async () => {
  const plain = new Map([['token', 'old']]), secure = new Map();
  let release, started;
  const ready = new Promise((resolve) => started = resolve), gate = new Promise((resolve) => release = resolve);
  const credentials = load('credentials', {
    '@react-native-async-storage/async-storage': { default: {
      getItem: async (key) => plain.get(key) ?? null, removeItem: async (key) => plain.delete(key),
    } },
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': { getItemAsync: async (key) => secure.get(key) ?? null,
      setItemAsync: async (key, value) => { started(); await gate; secure.set(key, value); },
      deleteItemAsync: async (key) => secure.delete(key) },
  });
  const read = credentials.readCredential('token'); await ready;
  const removal = credentials.removeCredential('token'); release();
  await Promise.all([read, removal]);
  assert.equal(secure.has('token'), false); assert.equal(plain.has('token'), false);
});
test('failed secure migration retains the legacy token but never returns insecure credentials', async () => {
  const plain = new Map([['token', 'old']]);
  const credentials = load('credentials', {
    '@react-native-async-storage/async-storage': { default: {
      getItem: async (key) => plain.get(key) ?? null, removeItem: async (key) => plain.delete(key),
    } },
    'react-native': { Platform: { OS: 'ios' } },
    'expo-secure-store': { getItemAsync: async () => null, setItemAsync: async () => { throw Error('Keychain unavailable'); } },
  });
  await assert.rejects(credentials.readCredential('token'), /Keychain unavailable/);
  assert.equal(plain.get('token'), 'old');
});
