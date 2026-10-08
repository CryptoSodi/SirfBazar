const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const app = process.argv[2];
if (!['merchant-app', 'rider-app'].includes(app)) throw new Error('Expected merchant-app or rider-app');
const appRoot = path.resolve(__dirname, '..', 'apps', app);
const { createRequire } = require('node:module');
const requireApp = createRequire(path.join(appRoot, 'package.json'));
let ts;
try { ts = requireApp('typescript'); }
catch { ts = createRequire(path.resolve(__dirname, '../apps/api/package.json'))('typescript'); }

function harness() {
  let owner = 'account-a', generation = 1, releasePermission;
  let riderApproval = 'APPROVED', riderActive = true;
  const user = () => !owner ? null : app === 'merchant-app'
    ? { id: owner, role: 'MERCHANT_OWNER', merchant: { id: `shop-${owner}` } }
    : { id: owner, role: 'RIDER', rider: { id: `rider-${owner}`, approvalStatus: riderApproval, isActive: riderActive } };
  const calls = [];
  const permissions = new Promise((resolve) => { releasePermission = resolve; });
  const api = { post: async (url, body) => { calls.push({ url, body, owner }); return { ok: true }; } };
  const Notifications = {
    setNotificationHandler() {}, AndroidImportance: { MAX: 5 },
    setNotificationChannelAsync: async () => undefined,
    getPermissionsAsync: () => permissions,
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[test]' }),
  };
  const source = fs.readFileSync(path.join(appRoot, 'lib/push.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => {
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === 'expo-constants') return { default: { expoConfig: {} } };
    if (name === 'expo-notifications') return Notifications;
    if (name === '@react-native-async-storage/async-storage') return { getItem: async (key) => key === 'sbm.authContext' ? 'merchant' : null };
    if (name === './api') return { api, API_URL: 'http://fixture.test/api', getAuthVersion: () => generation, getUser: async () => user() };
    throw new Error(`Unexpected import ${name}`);
  } }, { filename: 'push.js' });
  return { push: module.exports, calls, grant: () => releasePermission({ status: 'granted' }),
    switchAccount: () => { owner = 'account-b'; generation++; }, logout: () => { owner = null; generation++; },
    setRiderEligibility: (approval, active) => { riderApproval = approval; riderActive = active; generation++; } };
}

test(`${app}: logout while permission is pending never posts a stale registration`, async () => {
  const h = harness(); const pending = h.push.registerForPush();
  await new Promise(setImmediate); h.logout(); h.grant(); await pending;
  assert.equal(h.calls.length, 0);
});

test(`${app}: account switch while permission is pending cannot register the old identity`, async () => {
  const h = harness(); const pending = h.push.registerForPush();
  await new Promise(setImmediate); h.switchAccount(); h.grant(); await pending;
  assert.equal(h.calls.length, 0);
  await h.push.registerForPush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].owner, 'account-b');
});

test(`${app}: one active session registers once with the device token`, async () => {
  const h = harness(); h.grant();
  await h.push.registerForPush(); await h.push.registerForPush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].body.token, 'ExponentPushToken[test]');
});

if (app === 'rider-app') for (const [approval, active] of [['PENDING', true], ['APPROVED', false]]) {
  test(`rider-app: ${approval}/${active ? 'active' : 'inactive'} cannot register or display rider-scoped push`, async () => {
    const h = harness(); h.grant(); h.setRiderEligibility(approval, active);
    await h.push.registerForPush();
    assert.equal(h.calls.length, 0);
    assert.equal(await h.push.canReceivePush({ audience: 'RIDER', scopeId: 'rider-account-a' }), false);
    assert.equal(await h.push.canReceivePush({ audience: 'ACCOUNT', scopeId: 'account-a' }), true, 'account recovery notifications remain allowed');
  });
}
