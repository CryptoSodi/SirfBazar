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
function harness() {
  const data = new Map(); const requests = []; const events = [];
  const storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => data.set(k, v), removeItem: async k => data.delete(k) };
  const api = load('api', {
    '@react-native-async-storage/async-storage': { default: storage },
    './credentials': { readCredential: storage.getItem, writeCredential: storage.setItem, removeCredential: storage.removeItem },
    './customer-events': { publishCustomerEvent: name => events.push(name) },
    './customer-flow': load('customer-flow', {}), 'react-native': { Platform: { OS: 'web' } },
    'expo-constants': { default: { expoConfig: {} } },
  }, { fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200, json: async () => ({ sessionToken: 'guest', groups: [], itemCount: 0 }) }; } });
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
