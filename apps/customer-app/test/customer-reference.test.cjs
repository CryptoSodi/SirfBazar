const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps, extras = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/' + file + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: name => { if (!(name in deps)) throw Error(name); return deps[name]; },
    setTimeout, clearTimeout, AbortController, process, ...extras });
  return module.exports;
}
function harness(respond) {
  const data = new Map(); const requests = []; const events = [];
  const storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => data.set(k, v), removeItem: async k => data.delete(k) };
  const api = load('api', {
    './friendly-error': load('friendly-error', {}),
    '@react-native-async-storage/async-storage': { default: storage },
    './credentials': { readCredential: storage.getItem, writeCredential: storage.setItem, removeCredential: storage.removeItem },
    './customer-events': { publishCustomerEvent: name => events.push(name) },
    './toast-session': load('toast-session', {}),
    './customer-flow': load('customer-flow', {}), 'react-native': { Platform: { OS: 'web' } },
    'expo-constants': { default: { expoConfig: {} } },
  }, { fetch: async (url, options) => { requests.push({ url, options }); return respond ? respond(url, options) : { ok: true, status: 200, json: async () => ({ sessionToken: 'guest', groups: [], itemCount: 0 }) }; } });
  return { api, data, requests, events };
}
test('map fallback is not a confirmed delivery location', async () => {
  const { api, data } = harness();
  assert.equal(await api.getConfirmedLocation(), null);
  assert.equal((await api.getLocation()).confirmed, false);
  for (const location of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: '31', longitude: 74 }, { latitude: 31, longitude: 74, confirmed: false }, { latitude: 31, longitude: 74, label: 'Lahore demo area (choose your location)' }]) {
    data.set('sb.location', JSON.stringify(location)); assert.equal(await api.getConfirmedLocation(), null);
  }
  data.set('sb.location', '{broken'); assert.equal(await api.getConfirmedLocation(), null);
});
test('explicit area choice persists, and browsing without area really clears it locally', async () => {
  const { api, data, events } = harness();
  await api.setLocation({ latitude: 31.5, longitude: 74.3, label: 'Selected area' });
  assert.equal((await api.getConfirmedLocation()).confirmed, true);
  await api.clearLocation(); assert.equal(data.has('sb.location'), false); assert.equal(await api.getConfirmedLocation(), null);
  assert.deepEqual(events, ['location', 'location']);
});
test('public catalogue reads do not carry expired private credentials', async () => {
  const { api, data, requests } = harness(); data.set('sb.accessToken', 'expired-private');
  await api.api.get('/products/search?q=milk'); await api.api.get('/merchants/nearby');
  assert.equal(requests.every(r => !r.options.headers.authorization), true);
  await api.api.get('/customer/profile'); assert.equal(requests.at(-1).options.headers.authorization, 'Bearer expired-private');
});

test('ordinary and corrupt cached profiles preserve anonymous discovery', async () => {
  const { api, data, requests } = harness();
  data.set('sb.accessToken', 'private');
  for (const profile of [JSON.stringify({ id: 'ordinary-customer' }), '{broken']) {
    data.set('sb.user', profile);
    await api.api.get('/products/nearby');
  }
  assert.equal(requests.length, 2);
  assert.equal(requests.every(r => !r.options.headers.authorization), true);
});

test('review discovery refreshes once for concurrent reads and sends verified-session credentials', async () => {
  const user = { id: 'play-review-v1-user-customer' };
  const { api, data, requests } = harness(async url => ({ ok: true, status: 200, json: async () => url.endsWith('/auth/refresh-token')
    ? { accessToken: 'renewed-review', refreshToken: 'rotated-review', user }
    : { items: [{ id: 'play-review-v1-shop' }] } }));
  data.set('sb.user', JSON.stringify(user));
  data.set('sb.accessToken', 'expired-review');
  data.set('sb.refreshToken', 'review-refresh');
  const paths = ['/products/nearby', '/merchants/nearby', '/location/service-availability', '/coupons'];
  await Promise.all(paths.map(path => api.api.get(path)));
  assert.equal(requests.filter(r => r.url.endsWith('/auth/refresh-token')).length, 1);
  for (const request of requests.filter(r => !r.url.endsWith('/auth/refresh-token'))) {
    assert.equal(request.options.headers.authorization, 'Bearer renewed-review');
  }
});

test('revoked review session never falls back to ordinary discovery', async () => {
  const { api, data, requests } = harness(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  data.set('sb.user', JSON.stringify({ id: 'play-review-v1-user-customer' }));
  data.set('sb.accessToken', 'revoked-review');
  data.set('sb.refreshToken', 'revoked-refresh');
  await assert.rejects(api.api.get('/merchants/nearby'), error => error.status === 401);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.endsWith('/auth/refresh-token'), true);
});

test('cached review identity alone cannot authorize catalogue access', async () => {
  const { api, data, requests } = harness();
  data.set('sb.user', JSON.stringify({ id: 'play-review-v1-user-customer' }));
  await assert.rejects(api.api.get('/products/nearby'), error => error.status === 401);
  assert.equal(requests.length, 0);
});
test('unknown-area guest creation and cart fetch do not send map fallback coordinates', async () => {
  const { api, requests } = harness(); await api.fetchCart();
  assert.equal(requests.length, 2); assert.deepEqual(JSON.parse(requests[0].options.body), {});
  assert.equal(requests[1].url.includes('latitude'), false);
});
test('money preserves paisa and does not invent unknown zero amounts', () => {
  const { api } = harness(); assert.equal(api.pkr(12345), 'Rs 123.45'); assert.equal(api.pkr(0), 'Rs 0');
  for (const value of [undefined, null, NaN, Infinity]) assert.equal(api.pkr(value), 'Not available');
});
test('late appearance restore cannot overwrite a deliberate user selection', async () => {
  let finishRead; const writes = [];
  const theme = load('theme', {
    react: { useEffect() {}, useState() {} },
    'react-native': { Platform: { OS: 'web' }, StyleSheet: { create: s => s }, useColorScheme() {} },
    '@react-native-async-storage/async-storage': { default: { getItem: () => new Promise(resolve => finishRead = resolve), setItem: async (_, value) => writes.push(value) } },
  });
  const restore = theme.loadThemeMode(); theme.setThemeMode('dark'); finishRead('light'); await restore;
  assert.equal(theme.getThemeMode(), 'dark');
  theme.setThemeMode('light'); theme.setThemeMode('system');
  await new Promise(resolve => setTimeout(resolve, 0)); assert.deepEqual(writes, ['dark', 'light', 'system']);
});
