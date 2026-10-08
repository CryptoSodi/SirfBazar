const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const app = process.argv[2];
if (!['merchant-app', 'rider-app'].includes(app)) throw new Error('Expected merchant-app or rider-app');
const appRoot = path.resolve(__dirname, '..', 'apps', app);
const ts = require(path.resolve(appRoot, 'node_modules/typescript'));

function harness() {
  let owner = 'account-a', generation = 1, releasePermission;
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
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => {
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === 'expo-constants') return { default: { expoConfig: {} } };
    if (name === 'expo-notifications') return Notifications;
    if (name === './api') return { api, getAuthVersion: () => generation, getUser: async () => ({ id: owner }) };
    throw new Error(`Unexpected import ${name}`);
  } }, { filename: 'push.js' });
  return { push: module.exports, calls, grant: () => releasePermission({ status: 'granted' }),
    switchAccount: () => { owner = 'account-b'; generation++; }, logout: () => { owner = null; generation++; } };
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
