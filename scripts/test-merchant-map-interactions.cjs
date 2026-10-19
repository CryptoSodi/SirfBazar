const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const directory = path.join(__dirname, '../apps/merchant-app');
const ts = require(path.join(directory, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(directory, 'components/ShopLocationSettings.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function harness(profile, failSave = false) {
  const hooks = []; let cursor = 0; let focused = false; let cleanup;
  const requests = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useCallback(callback) { return callback; },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const api = {
    get: async endpoint => { requests.push({ method: 'GET', endpoint }); return profile; },
    put: async (endpoint, body) => { requests.push({ method: 'PUT', endpoint, body }); if (failSave) throw new Error('offline'); return body; },
  };
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@react-navigation/native': { useFocusEffect: callback => { if (!focused) { focused = true; cleanup = callback(); } } },
    'react-native': { ActivityIndicator: 'Spinner', Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '../lib/api': { api }, '../lib/theme': { colors: {}, s: {} },
    '../lib/shop-location': { isShopPoint: value => !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) },
    './IconLabel': { IconLabel: 'Label' }, './ShopMapPicker': { default: 'Picker' },
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name];
  } });
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];
  const label = node => typeof node === 'string' ? node : node && typeof node === 'object' ? [node.props?.children].flat(Infinity).map(label).join('') : '';
  const render = () => { cursor = 0; return flatten(module.exports.default()); };
  return { requests, render, cleanup: () => cleanup?.(), button: name => render().find(node => node.type === 'Button' && label(node) === name),
    picker: () => render().find(node => node.type === 'Picker') };
}
const owner = { latitude: 31.52, longitude: 74.35, approvalStatus: 'APPROVED', isOwner: true, permissions: [] };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('existing merchant confirms a draft before an explicit coordinate-only save', async () => {
  const h = harness(owner); h.render(); await tick();
  assert.equal(h.requests.length, 1);
  h.button('Edit shop entrance pin').props.onPress();
  const picker = h.picker();
  assert.equal(picker.props.initial.latitude, owner.latitude);
  picker.props.onConfirm({ latitude: 32, longitude: 73 });
  assert.equal(h.requests.length, 1, 'confirming a map must not write to the server');
  h.button('Save shop location').props.onPress(); await tick();
  assert.equal(JSON.stringify(h.requests[1]), JSON.stringify({ method: 'PUT', endpoint: '/merchant/profile', body: { latitude: 32, longitude: 73 } }));
  assert.equal(h.button('Save shop location'), undefined);
});
test('cancel map leaves saved location untouched and never calls update', async () => {
  const h = harness(owner); h.render(); await tick();
  h.button('Edit shop entrance pin').props.onPress(); h.picker().props.onClose();
  assert.equal(h.picker(), undefined);
  assert.equal(h.button('Save shop location'), undefined);
  assert.equal(h.requests.length, 1);
});
test('staff without STORE permission and unapproved shops cannot edit', async () => {
  for (const profile of [{ ...owner, isOwner: false }, { ...owner, approvalStatus: 'SUSPENDED' }]) {
    const h = harness(profile); h.render(); await tick();
    assert.equal(h.button('Edit shop entrance pin'), undefined);
    assert.equal(h.requests.length, 1);
  }
  const staff = harness({ ...owner, isOwner: false, permissions: ['STORE'] }); staff.render(); await tick();
  assert.ok(staff.button('Edit shop entrance pin'));
});
test('failed save retains draft, prevents double submit, and supports retry', async () => {
  const h = harness(owner, true); h.render(); await tick();
  h.button('Edit shop entrance pin').props.onPress(); h.picker().props.onConfirm({ latitude: 32, longitude: 73 });
  const save = h.button('Save shop location'); save.props.onPress(); save.props.onPress(); await tick();
  assert.equal(h.requests.filter(request => request.method === 'PUT').length, 1);
  assert.ok(h.button('Save shop location'));
  h.button('Save shop location').props.onPress(); await tick();
  assert.equal(h.requests.filter(request => request.method === 'PUT').length, 2);
});

function pickerHarness(location = {}, initial = null, configured = true) {
  const hooks = []; let cursor = 0; let nextTimer = 1;
  let unmounted = false; let lateUpdates = 0;
  const timers = new Map(); const confirmed = [];
  const react = {
    useState(value) { const index = cursor++; if (!(index in hooks)) hooks[index] = value;
      return [hooks[index], update => { if (unmounted) lateUpdates++; hooks[index] = typeof update === 'function' ? update(hooks[index]) : update; }]; },
    useRef(value) { const index = cursor++; return hooks[index] ??= { current: value }; },
    useEffect(effect, deps) { const index = cursor++; const before = hooks[index];
      if (before && before.deps.length === deps.length && deps.every((value, i) => value === before.deps[i])) return;
      before?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; },
  };
  const helper = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(directory, 'lib/shop-location.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: helper, exports: helper.exports });
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ActivityIndicator: 'Spinner', Modal: 'Modal', Platform: { OS: 'android' }, KeyboardAvoidingView: 'KeyboardAvoidingView',
      ScrollView: 'ScrollView', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    'react-native-maps': { __esModule: true, default: 'Map', Marker: 'Marker', PROVIDER_GOOGLE: 'google' },
    'expo-location': { Accuracy: { High: 4 }, requestForegroundPermissionsAsync: async () => ({ granted: true }),
      hasServicesEnabledAsync: async () => true, getCurrentPositionAsync: async () => ({ coords: { latitude: 33, longitude: 72 } }), ...location },
    './AppIcon': { AppIcon: 'Icon' }, '../lib/theme': { colors: {}, s: {} }, '../lib/shop-location': helper.exports,
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(directory, 'components/ShopMapPicker.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name];
  }, process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: configured ? 'AIza' + 'x'.repeat(35) : '' } },
  setTimeout: (callback, ms) => { const id = nextTimer++; timers.set(id, { callback, ms }); return id; }, clearTimeout: id => timers.delete(id) });
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];
  const label = node => typeof node === 'string' ? node : node && typeof node === 'object' ? [node.props?.children].flat(Infinity).map(label).join('') : '';
  const render = () => { cursor = 0; return flatten(module.exports.default({ initial, onConfirm: point => confirmed.push(point), onClose() {} })); };
  return { confirmed, render, button: name => render().find(node => node.type === 'Button' && label(node) === name),
    map: () => render().find(node => node.type === 'Map'), input: name => render().find(node => node.type === 'Input' && node.props.accessibilityLabel === name),
    unmount: () => { hooks.forEach(value => value?.cleanup?.()); unmounted = true; }, lateUpdates: () => lateUpdates,
    fireTimer: ms => { const timer = [...timers.values()].find(timer => timer.ms === ms); assert.ok(timer); timer.callback(); } };
}

test('map camera is not a selected pin; tapping selects without saving until confirmation', () => {
  const h = pickerHarness();
  assert.equal(h.button('Confirm pin').props.disabled, true);
  assert.equal(h.render().some(node => node.type === 'Marker'), false);
  h.map().props.onPress({ nativeEvent: { coordinate: { latitude: 31, longitude: 74 } } });
  assert.equal(h.confirmed.length, 0);
  assert.equal(h.button('Confirm pin').props.disabled, false);
  h.button('Confirm pin').props.onPress();
  assert.equal(JSON.stringify(h.confirmed), JSON.stringify([{ latitude: 31, longitude: 74 }]));
});
test('denied GPS leaves manual map selection available', async () => {
  const h = pickerHarness({ requestForegroundPermissionsAsync: async () => ({ granted: false }) });
  h.button('Use current location').props.onPress(); await tick();
  assert.equal(h.button('Confirm pin').props.disabled, true);
  assert.ok(h.render().some(node => node.props.accessibilityRole === 'alert'));
  h.map().props.onPress({ nativeEvent: { coordinate: { latitude: 32, longitude: 73 } } });
  assert.equal(h.button('Confirm pin').props.disabled, false);
});
test('late GPS response cannot overwrite a newer manual pin', async () => {
  let resolve;
  const h = pickerHarness({ getCurrentPositionAsync: () => new Promise(done => { resolve = done; }) });
  h.button('Use current location').props.onPress(); await tick();
  h.map().props.onPress({ nativeEvent: { coordinate: { latitude: 32, longitude: 73 } } });
  resolve({ coords: { latitude: 33, longitude: 72 } }); await tick();
  h.button('Confirm pin').props.onPress();
  assert.equal(JSON.stringify(h.confirmed), JSON.stringify([{ latitude: 32, longitude: 73 }]));
});
test('GPS fix timeout restores manual selection', async () => {
  const h = pickerHarness({ getCurrentPositionAsync: () => new Promise(() => {}) });
  h.button('Use current location').props.onPress(); await tick(); h.fireTimer(15000); await tick();
  assert.ok(h.button('Use current location'));
  assert.equal(h.button('Confirm pin').props.disabled, true);
  h.unmount();
});
test('closing picker invalidates an in-flight GPS response without updating state', async () => {
  let resolve;
  const h = pickerHarness({ getCurrentPositionAsync: () => new Promise(done => { resolve = done; }) });
  h.button('Use current location').props.onPress(); await tick(); h.unmount();
  resolve({ coords: { latitude: 33, longitude: 72 } }); await tick();
  assert.equal(h.lateUpdates(), 0);
  assert.equal(h.confirmed.length, 0);
});
test('missing native configuration has a validated coordinate fallback, including zero', () => {
  const h = pickerHarness({}, null, false);
  assert.equal(h.map(), undefined);
  h.button('Coordinates').props.onPress();
  h.button('Select coordinates').props.onPress();
  assert.equal(h.button('Confirm pin').props.disabled, true);
  h.input('Shop latitude').props.onChangeText('0'); h.input('Shop longitude').props.onChangeText('0');
  h.button('Select coordinates').props.onPress(); h.button('Confirm pin').props.onPress();
  assert.equal(JSON.stringify(h.confirmed), JSON.stringify([{ latitude: 0, longitude: 0 }]));
});
