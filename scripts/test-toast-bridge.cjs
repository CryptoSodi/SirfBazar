const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/pos/node_modules/typescript');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function mount(file, cutAt, expose, dependencies, globals = {}) {
  const hooks = [];
  let index = 0;
  const react = {
    useState(initial) {
      const position = index++;
      if (!(position in hooks)) hooks[position] = typeof initial === 'function' ? initial() : initial;
      return [hooks[position], value => { hooks[position] = typeof value === 'function' ? value(hooks[position]) : value; }];
    },
    useRef(initial) {
      const position = index++;
      if (!(position in hooks)) hooks[position] = { current: initial };
      return hooks[position];
    },
    useEffect(effect) { if (file.includes('AddressesScreen')) effect(); }, useLayoutEffect() {}, useCallback: callback => callback,
  };
  const raw = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const offset = raw.lastIndexOf(cutAt);
  assert.ok(offset > 0, `${file}: component return located`);
  const source = (raw.slice(0, offset) + expose + '\n  return null;\n}')
    .replace(/import\.meta\.env/g, '({ VITE_GOOGLE_MAPS_API_KEY: "", DEV: false })');
  const exports = {};
  const context = vm.createContext({
    exports, process: { env: {} }, setTimeout, clearTimeout, Date, window: { setInterval, clearInterval },
    document: { activeElement: null, getElementById: () => null, scrollingElement: null, body: {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name in dependencies) return dependencies[name];
      if (name.endsWith('.css')) return {};
      if (name === 'lucide-react' || name === './AuthChrome' || name === './GooglePinMap' || name === '../components/ShopMapPicker' || name === './GoogleSignIn') return {};
      throw Error(`${file}: unexpected dependency ${name}`);
    },
    ...globals,
  });
  vm.runInContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context, { filename: file });
  const component = exports.LoginSheet || exports.default;
  return { render(props = {}) { index = 0; component(props); return context; }, context };
}

;(async () => {
  let checks = 0;
  let epoch = 'anonymous';
  const captureSession = () => ({ epoch });
  const sessionGenerationIsCurrent = origin => origin.epoch === epoch;
  let request = deferred();
  class CartMergeUncertainError extends Error {}
  let afterLogin = async () => {};
  const web = mount('apps/web/components/LoginSheet.tsx', '  return (',
    '  globalThis.__actions = {sendOtp, verify, loginWithIdToken}; globalThis.__state = {step, error, busy};', {
      '@/components/Toast': { ToastMessage() {} },
      'next/navigation': { useRouter: () => ({ push() {} }) },
      'next/link': {}, '@react-oauth/google': {},
      '@/lib/api': {
        api: { post: () => request.promise }, captureSession, sessionGenerationIsCurrent,
        CartMergeUncertainError, afterLogin: (...args) => afterLogin(...args),
      },
    });
  const renderWeb = () => web.render({ onClose() {}, onSuccess() {} });
  let state = renderWeb();
  const lateFailure = state.__actions.loginWithIdToken('google-A');
  epoch = 'B';
  request.reject(Error('A failed'));
  await lateFailure;
  state = renderWeb();
  assert.equal(state.__state.error, '', 'late A login error does not become B ToastMessage'); checks++;
  request = deferred();
  const ownFailure = state.__actions.loginWithIdToken('google-B');
  request.reject(Error('B failed'));
  await ownFailure;
  state = renderWeb();
  assert.equal(state.__state.error, 'B failed', 'current login error remains visible'); checks++;
  request = deferred();
  afterLogin = () => { epoch = 'C'; return Promise.reject(new CartMergeUncertainError('merge uncertain')); };
  const ownMerge = state.__actions.loginWithIdToken('google-C');
  request.resolve({ accessToken: 'C' });
  await ownMerge;
  state = renderWeb();
  assert.equal(state.__state.step, 'merge-error', 'own auth transition retains durable merge recovery'); checks++;

  const schema = new Proxy({}, { get: (_target, key) => key === 'safeParse' ? () => ({ success: true }) : () => schema });
  const z = new Proxy({}, { get: () => () => schema });
  let registration = deferred();
  let verification = deferred();
  const form = { control: {}, formState: { errors: {} }, getValues: () => ({
    firstName: 'A', lastName: 'Merchant', channel: 'mobile', contact: '03001234567',
    cnic: '3520112345678', password: 'valid1234', shopName: 'Test', shopContact: '03001234567',
    businessType: 'kiryana', address: 'Street, Lahore',
  }), setValue() {}, clearErrors() {}, register: () => ({}), handleSubmit: fn => fn };
  const shop = mount('apps/shop/src/auth/SignupFlowPage.tsx', '  return <div className="auth-page signup-page">',
    '  globalThis.__actions = {submitShop, verifyAndCreate, setLatitude, setLongitude, setAttemptId, setCode}; globalThis.__state = {requestError, codeError, attemptId};', {
      '@hookform/resolvers/zod': { zodResolver: () => () => ({}) },
      'react-hook-form': { useForm: () => form, useWatch: () => 'mobile' },
      'react-router-dom': { useNavigate: () => () => {}, Link() {} },
      zod: { z },
      './lib/api': { ApiError: class ApiError extends Error {}, merchantApi: {
        startRegistration: () => registration.promise,
        verifyRegistration: () => verification.promise,
      } },
      '../lib/api': { captureSession, sessionGenerationIsCurrent },
      './lib/session': { getSession: () => null, saveSession() {} },
    });
  const renderShop = () => shop.render();
  state = renderShop();
  state.__actions.setLatitude('31.5'); state.__actions.setLongitude('74.3');
  state = renderShop();
  const oldRegistration = state.__actions.submitShop();
  epoch = 'D';
  registration.reject(Error('A registration failed'));
  await oldRegistration;
  state = renderShop();
  assert.equal(state.__state.requestError, '', 'late merchant registration error cannot become B ToastMessage'); checks++;
  registration = deferred();
  const ownRegistration = state.__actions.submitShop();
  registration.reject(Error('current registration failed'));
  await ownRegistration;
  state = renderShop();
  assert.equal(state.__state.requestError, 'Could not start merchant registration. Please try again.', 'current merchant failure retains feedback'); checks++;
  state.__actions.setAttemptId('attempt-A'); state.__actions.setCode('123456');
  state = renderShop();
  const oldVerification = state.__actions.verifyAndCreate();
  epoch = 'E';
  verification.reject(Error('A verification failed'));
  await oldVerification;
  state = renderShop();
  assert.equal(state.__state.codeError, '', 'late merchant verification error cannot become B field error'); checks++;

  let nativeGeneration = 0;
  let onNativeInvalidated = () => {};
  const native = mount('apps/customer-app/screens/AddressesScreen.tsx', '  return <View style={s.screen}>',
    '  globalThis.__actions = {mutate, load}; globalThis.__state = {error, busy};', {
      '@react-navigation/native': { useFocusEffect() {}, useNavigation: () => ({ navigate() {} }) },
      'react-native': {}, '../components/LoginSheet': {},
      '../lib/api': { api: { get: async () => [] }, isLoggedIn: async () => true },
      '../lib/toast-session': { toastSessionGeneration: () => nativeGeneration, onSessionInvalidated: listener => { onNativeInvalidated = listener; return () => {}; } },
      '../lib/theme': { useTheme: () => ({ colors: {}, s: {} }) },
      '../components/CustomerUI': { usePageInset: () => 12 },
    });
  const renderNative = () => native.render();
  state = renderNative();
  const oldAction = deferred();
  const oldMutation = state.__actions.mutate(() => oldAction.promise, 'Retry safely.');
  nativeGeneration++;
  onNativeInvalidated();
  oldAction.reject(Error('A address failure'));
  await oldMutation;
  state = renderNative();
  assert.equal(state.__state.error, '', 'late A address failure cannot become B ToastMessage'); checks++;
  const ownAction = deferred();
  const ownMutation = state.__actions.mutate(() => ownAction.promise, 'Retry safely.');
  ownAction.reject(Error('B address failure'));
  await ownMutation;
  state = renderNative();
  assert.equal(state.__state.error, 'B address failure Retry safely.', 'current address failure remains visible'); checks++;
  process.stdout.write(`Mounted feedback bridge: ${checks} actual-source cases passed.\n`);
})().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
