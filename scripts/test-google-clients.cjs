const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/api/node_modules/typescript');

// Match the repository's existing isolated component tests: real handlers, mocked React/SDK/transport.
function harness(file, { imports = {}, globals = {}, post, googleToken = 'google-token', env = { VITE_GOOGLE_CLIENT_ID: 'web.apps.googleusercontent.com' } } = {}) {
  const hooks = [], calls = [], toasts = [];
  let cursor = 0;
  let sessionEpoch = 'A';
  const react = {
    useRef: value => { const slot = cursor++; return hooks[slot] ??= { current: value }; },
    useState: value => { const slot = cursor++; if (!(slot in hooks)) hooks[slot] = typeof value === 'function' ? value() : value;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }]; },
    useEffect: () => {},
  };
  const jsx = (type, props) => ({ type, props });
  const api = { post: async (url, body) => { calls.push({ url, body }); return post?.(url, body); } };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replaceAll('import.meta.env', 'testEnv');
  const exports = {};
  const standard = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@react-oauth/google': { GoogleLogin: 'GoogleLogin', GoogleOAuthProvider: 'GoogleOAuthProvider' },
    'react-native': { Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '../lib/api': { api },
    '../lib/google': { googleSignInIdToken: async () => googleToken },
    '../lib/theme': { s: {}, useTheme: () => ({ s: {} }) },
    '../lib/appearance': { useRiderTheme: () => ({ palette: {} }) },
    '../components/Toast': { ToastMessage: 'ToastMessage' },
    './Toast': { useToast: () => {
      const owner = sessionEpoch;
      return { toast: (message, success) => { if (owner === sessionEpoch) toasts.push({ message, success }); } };
    } },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, testEnv: env, process: { env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: env.VITE_GOOGLE_CLIENT_ID } },
    require: name => { if (name.endsWith('.css')) return {}; if (name in imports) return imports[name]; if (name in standard) return standard[name]; throw Error(`Unexpected import: ${name}`); },
    ...globals,
  });
  return { calls, toasts, setSession: epoch => { sessionEpoch = epoch; }, exports,
    render: (name = 'GoogleAccountLink', props) => { cursor = 0; return exports[name](props); } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
  return null;
}
const byType = (tree, type) => find(tree, node => node.type === type);
const flush = () => new Promise(setImmediate);

for (const app of ['web', 'admin', 'pos', 'shop']) {
  const file = `apps/${app}/${app === 'web' ? '' : 'src/'}components/GoogleAccountLink.tsx`;
  test(`${app}: explicit authenticated linking sends only Google proof, not client-selected user or role`, async () => {
    let resolve;
    const h = harness(file, { post: () => new Promise(done => { resolve = done; }) });
    byType(h.render(), 'button').props.onClick();
    const google = byType(h.render(), 'GoogleLogin');
    google.props.onSuccess({ credential: 'proof' });
    google.props.onSuccess({ credential: 'proof' });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].url, '/auth/google-link');
    assert.deepEqual(Object.keys(h.calls[0].body), ['idToken']);
    resolve({ linked: true }); await flush();
    if (app === 'web') assert.equal(h.toasts.at(-1)?.message, 'Google is linked to this account.');
    else assert.ok(find(h.render(), node => node.props?.role === 'status'));
  });
  test(`${app}: no credential or SDK error does not call API; provider failure permits retry`, async () => {
    const h = harness(file, { post: async () => { throw Error('Service unavailable'); } });
    byType(h.render(), 'button').props.onClick();
    const google = byType(h.render(), 'GoogleLogin');
    google.props.onError(); google.props.onSuccess({}); await flush();
    assert.equal(h.calls.length, 0);
    google.props.onSuccess({ credential: 'proof' }); await flush();
    if (app === 'web') assert.equal(h.toasts.at(-1)?.message, 'Service unavailable');
    else assert.equal(find(h.render(), node => node.props?.role === 'alert').props.children, 'Service unavailable');
    google.props.onSuccess({ credential: 'proof' }); await flush();
    assert.equal(h.calls.length, 2);
  });
}
test('web: a completed Google link from the previous account cannot enqueue success feedback', async () => {
  let resolve;
  const h = harness('apps/web/components/GoogleAccountLink.tsx', { post: () => new Promise(done => { resolve = done; }) });
  byType(h.render(), 'button').props.onClick();
  byType(h.render(), 'GoogleLogin').props.onSuccess({ credential: 'proof-A' });
  assert.equal(h.calls.length, 1);
  h.setSession('B');
  resolve({ linked: true }); await flush();
  assert.equal(h.toasts.length, 0);
  assert.deepEqual(Object.keys(h.calls[0].body), ['idToken']);
});
for (const app of ['customer-app', 'merchant-app', 'rider-app']) {
  const file = `apps/${app}/components/GoogleAccountLink.tsx`;
  test(`${app}: native cancelled linking never calls API`, async () => {
    const h = harness(file, { googleToken: null });
    byType(h.render(), 'Button').props.onPress(); await flush();
    assert.equal(h.calls.length, 0);
  });
  test(`${app}: repeated link tap sends once and reports a retryable failure`, async () => {
    const h = harness(file, { post: async () => { throw Error('Offline'); } });
    const button = byType(h.render(), 'Button');
    button.props.onPress(); button.props.onPress(); await flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].url, '/auth/google-link');
    assert.ok(find(h.render(), node => node.props?.children === 'Offline'));
    byType(h.render(), 'Button').props.onPress(); await flush();
    assert.equal(h.calls.length, 2);
  });
}
test('rider login keeps a single request active until Google login finishes', async () => {
  let resolve, requests = 0;
  const stored = [], navigations = [];
  const h = harness('apps/rider-app/screens/RiderLoginScreen.tsx', {
    imports: {
      '@react-navigation/native': { useNavigation: () => ({ reset: value => navigations.push(value) }) },
      '../components/RiderUI': Object.fromEntries(['Body', 'Button', 'Dock', 'Field', 'H1', 'Icon', 'IconBox', 'Label', 'LinkButton', 'Note', 'Page', 'Sheet'].map(name => [name, name])),
      '../lib/api': { api: { post: async () => { requests++; return new Promise(done => { resolve = done; }); } }, ApiError: Error, storeAuth: async auth => stored.push(auth) },
      '../assets/brand/rider-slogan-light.png': 'image',
    },
  });
  const button = find(h.render('default'), node => node.type === 'Button' && node.props.children === 'Continue with Google');
  button.props.onPress(); button.props.onPress(); await flush();
  assert.equal(requests, 1);
  assert.equal(find(h.render('default'), node => node.type === 'Button' && node.props.children === 'Continue with Google').props.disabled, true);
  resolve({ user: { rider: { id: 'rider' } } }); await flush();
  assert.equal(stored.length, 1);
  assert.equal(navigations[0].routes[0].name, 'Home');
  assert.equal(find(h.render('default'), node => node.type === 'Button' && node.props.children === 'Continue with Google').props.disabled, false);
});

for (const [name, user, allowed] of [
  ['owner', { merchant: { id: 'shop' } }, true],
  ['active staff', { staffOf: [{ status: 'ACTIVE' }] }, true],
  ['inactive staff', { staffOf: [{ status: 'INACTIVE' }] }, false],
  ['customer', {}, false],
]) test(`merchant Google session adapter checks ${name} membership`, async () => {
  const requests = [];
  const current = { epoch: 'A', identity: null };
  const h = harness('apps/shop/src/auth/lib/api.ts', {
    imports: {
      '../../lib/api': { API_URL: 'http://localhost:3001/api', ApiError: Error,
        resolveApiUrl: (base, path) => base + path,
        captureSession: () => ({ ...current }),
        sessionGenerationIsCurrent: origin => origin.epoch === current.epoch && origin.identity === current.identity,
        storeAuth() {} },
      '../../lib/friendly-error': harness('apps/shop/src/lib/friendly-error.ts').exports,
    },
    globals: { AbortSignal, fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ accessToken: 'session', refreshToken: 'refresh', user }) }; } },
  });
  if (allowed) assert.equal((await h.exports.merchantApi.googleLogin('proof')).role, 1);
  else await assert.rejects(h.exports.merchantApi.googleLogin('proof'), e => e.status === 403);
  assert.equal(requests[0].url, 'http://localhost:3001/api/auth/google-login');
  assert.deepEqual(JSON.parse(requests[0].options.body), { idToken: 'proof', context: 'merchant' });
  assert.ok(requests[0].options.signal);
});

test('merchant Google adapter rejects an old account response after session replacement', async () => {
  let release;
  const current = { epoch: 'A', identity: 'A:MERCHANT_OWNER:shop-A' };
  const h = harness('apps/shop/src/auth/lib/api.ts', {
    imports: {
      '../../lib/api': { API_URL: 'http://localhost:3001/api', ApiError: Error,
        resolveApiUrl: (base, path) => base + path,
        captureSession: () => ({ ...current }),
        sessionGenerationIsCurrent: origin => origin.epoch === current.epoch && origin.identity === current.identity,
        storeAuth() {} },
      '../../lib/friendly-error': harness('apps/shop/src/lib/friendly-error.ts').exports,
    },
    globals: { AbortSignal, fetch: () => new Promise(done => { release = done; }) },
  });
  const pending = h.exports.merchantApi.googleLogin('proof-A');
  current.epoch = 'B'; current.identity = 'B:MERCHANT_OWNER:shop-B';
  release({ ok: true, json: async () => ({ accessToken: 'token-A', user: { merchant: { id: 'shop-A' } } }) });
  await assert.rejects(pending, error => error.status === 409 && /session changed/i.test(error.message));
});

test('merchant Google widget does not silently retry, duplicate submissions or send an empty credential', async () => {
  let calls = 0, resolve;
  const h = harness('apps/shop/src/auth/GoogleSignIn.tsx');
  const props = { onCredential: async () => { calls++; await new Promise(done => { resolve = done; }); } };
  const google = byType(h.render('default', props), 'GoogleLogin');
  google.props.onSuccess({}); await flush();
  assert.equal(calls, 0);
  google.props.onSuccess({ credential: 'proof' }); google.props.onSuccess({ credential: 'proof' });
  assert.equal(calls, 1);
  resolve(); await flush();
  byType(h.render('default', { ...props, disabled: true }), 'GoogleLogin').props.onSuccess({ credential: 'proof' });
  assert.equal(calls, 1);
});
