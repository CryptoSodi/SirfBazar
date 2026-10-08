const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/pos/node_modules/typescript');
const { webcrypto } = require('node:crypto');

;(async () => {
let checks = 0;
for (const [app, path, key] of [
  ['web', 'apps/web/components/Toast.tsx', 'sb.session'],
  ['shop', 'apps/shop/src/components/Toast.tsx', 'sbs.session'],
  ['admin', 'apps/admin/src/components/Toast.tsx', 'sba.session'],
  ['pos', 'apps/pos/src/components/Toast.tsx', 'sbp.session'],
]) {
  const values = new Map();
  const exports = {};
  const storage = { getItem: (name) => values.get(name) ?? null, setItem: (name, value) => values.set(name, String(value)), removeItem: (name) => values.delete(name) };
  const context = vm.createContext({
    exports,
    localStorage: storage,
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setTimeout, clearTimeout },
    require(name) {
      if (name === 'react') return {
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
        useCallback: (callback) => callback,
      };
      if (name === 'react-dom') return { createPortal: (node) => node };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name.endsWith('/friendly-error')) return { friendlyError: (message) => message };
      throw Error(`${app}: unexpected dependency ${name}`);
    },
  });
  const source = readFileSync(resolve(__dirname, '..', path), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context, { filename: path });
  const size = () => vm.runInContext('queue.length', context);
  const current = (epoch, identity) => values.set(key, JSON.stringify({ epoch, identity }));
  const old = exports.useToast().toast;
  current('B', 'B:CUSTOMER:');
  old('late A failure', false);
  assert.equal(size(), 0, `${app}: old anonymous operation cannot enqueue under B`); checks++;
  const own = exports.useToast().toast;
  own('B action succeeded');
  assert.equal(size(), 1, `${app}: B feedback appears`); checks++;
  current('B', 'B:CUSTOMER:');
  own('B refresh succeeded');
  assert.equal(size(), 2, `${app}: same-owner token rotation preserves feedback`); checks++;
  current('C', 'C:CUSTOMER:');
  own('late B failure', false);
  assert.equal(size(), 2, `${app}: prior account cannot enqueue under C`); checks++;

  const prefix = app === 'web' ? 'apps/web/lib/' : `apps/${app}/src/lib/`;
  const helperExports = {};
  const helperContext = vm.createContext({
    exports: helperExports, localStorage: storage, window: context.window,
    crypto: webcrypto, atob, Event, AbortController, setTimeout, clearTimeout,
    navigator: { locks: { request: async (_name, work) => work() } },
  });
  const transpile = (file) => ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8').replace(/import\.meta\.env/g, '({ VITE_API_URL: "http://fixture.test/api" })'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInContext(transpile(prefix + 'browserSession.ts'), helperContext);
  const apiExports = {};
  let send = async () => ({ ok: true, status: 200, json: async () => ({}) });
  const apiContext = vm.createContext({
    exports: apiExports, localStorage: storage, window: context.window,
    crypto: webcrypto, atob, Event, URL, AbortController, setTimeout, clearTimeout,
    navigator: { locks: { request: async (_name, work) => work() } },
    location: { href: '', assign() {} }, process: { env: { NEXT_PUBLIC_API_URL: 'http://fixture.test/api' } },
    fetch: (...args) => send(...args),
    require(name) {
      if (name === './browserSession') return helperExports;
      if (name === './friendly-error') return { friendlyError: (message) => message };
      if (name === './memoryCache') return { clearMemory() {}, invalidateMemory() {} };
      throw Error(`${app}: unexpected API dependency ${name}`);
    },
  });
  vm.runInContext(transpile(prefix + 'api.ts'), apiContext);
  const auth = (id) => ({
    accessToken: `e30.${Buffer.from(JSON.stringify({ role: app === 'web' ? 'CUSTOMER' : 'MERCHANT_OWNER' })).toString('base64url')}.x`,
    refreshToken: `refresh-${id}`,
    user: { id, role: app === 'web' ? 'CUSTOMER' : 'MERCHANT_OWNER', merchant: app === 'web' ? undefined : { id: `shop-${id}` } },
  });
  apiExports.storeAuth(auth('A'));
  const pendingToast = exports.useToast().toast;
  let rejectOld;
  send = () => new Promise((_, reject) => { rejectOld = reject; });
  const pendingRequest = apiExports.api.get('/private').catch((error) => pendingToast(error.message, false));
  await new Promise((resolve) => setTimeout(resolve, 0));
  apiExports.storeAuth(auth('B'));
  rejectOld(Error('Old request failed'));
  await pendingRequest;
  assert.equal(size(), 2, `${app}: old API catch cannot enqueue under B`); checks++;
  exports.useToast().toast('B request completed');
  assert.equal(size(), 3, `${app}: new API feedback appears`); checks++;
  if (app === 'web') {
    const before = size();
    const feedback = exports.useToast();
    feedback.toast('Location save failed', false);
    feedback.toast('Unrelated operation failed', false);
    feedback.dismiss('Location save failed', false);
    assert.equal(size(), before + 1, 'targeted dismissal preserves unrelated notifications'); checks++;
    feedback.toast('Location updated');
    assert.equal(vm.runInContext('queue.some(item => item.text === "Location save failed")', context), false, 'retry feedback removes only the recovered error'); checks++;
    current('D', 'D:CUSTOMER:');
    const nextOwner = exports.useToast();
    nextOwner.toast('Location save failed', false);
    const nextSize = size();
    feedback.dismiss('Location save failed', false);
    assert.equal(size(), nextSize, 'old session cannot dismiss new-owner feedback'); checks++;
    nextOwner.dismiss('Location save failed', false);
    assert.equal(size(), nextSize - 1, 'current session can dismiss its recovered error'); checks++;
  }
}
for (const app of ['customer-app', 'merchant-app', 'rider-app']) {
  const signalExports = {};
  const signalContext = vm.createContext({ exports: signalExports });
  const signalPath = resolve(__dirname, '..', 'apps', app, 'lib/toast-session.ts');
  vm.runInContext(ts.transpileModule(readFileSync(signalPath, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, signalContext, { filename: signalPath });
  const exports = {};
  const context = vm.createContext({
    exports,
    require(name) {
      if (name === 'react') return {
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
        useCallback: (callback) => callback,
      };
      if (name === 'react-native') return {};
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === '../lib/toast-session') return signalExports;
      if (name === '../lib/friendly-error') return { friendlyError: (message) => message };
      throw Error(`${app}: unexpected dependency ${name}`);
    },
  });
  const path = resolve(__dirname, '..', 'apps', app, 'components/Toast.tsx');
  vm.runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context, { filename: path });
  const size = () => vm.runInContext('queue.length', context);
  const old = exports.useToast();
  signalExports.invalidateSessionToasts();
  old('late old account failure', false);
  assert.equal(size(), 0, `${app}: previous account cannot enqueue after invalidation`); checks++;
  const current = exports.useToast();
  current('new account action succeeded');
  assert.equal(size(), 1, `${app}: new account feedback appears`); checks++;
  signalExports.invalidateSessionToasts();
  current('late prior account failure', false);
  assert.equal(size(), 1, `${app}: second switch invalidates captured callback`); checks++;
}
process.stdout.write(`Owner-bound toast callbacks: ${checks} actual-source cases passed.\n`);
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
