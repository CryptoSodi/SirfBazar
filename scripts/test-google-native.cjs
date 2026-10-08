const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/api/node_modules/typescript');
const webClientId = '453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com';
const registeredIosClients = {
  'customer-app': '453311658725-16h5ooes2sp3g4o27hr6vrdt1am7hsgt.apps.googleusercontent.com',
  'merchant-app': '453311658725-6h8ucua4jvfopqrb6utj1ail4vaphki4.apps.googleusercontent.com',
  'rider-app': '453311658725-vask2pqmgpb023vhs3jm0l0u8hr7h96i.apps.googleusercontent.com',
};

function load(app, options = {}) {
  const calls = [];
  const sdk = {
    GoogleSignin: {
      configure: config => calls.push(['configure', config]),
      hasPlayServices: async () => { calls.push(['playServices']); },
      signOut: async () => { calls.push(['signOut']); },
      signIn: async () => { calls.push(['signIn']); if (options.error) throw options.error; return options.response || { type: 'success', data: { idToken: 'signed-token' } }; },
    },
    isSuccessResponse: response => response.type === 'success',
    isErrorWithCode: error => !!error.code,
    statusCodes: { SIGN_IN_CANCELLED: 'cancelled', IN_PROGRESS: 'in-progress', PLAY_SERVICES_NOT_AVAILABLE: 'missing-play' },
  };
  const source = fs.readFileSync(path.join(__dirname, `../apps/${app}/lib/google.ts`), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, process: { env: options.env || {} }, require: name => {
    if (name === 'react-native') return { Platform: { OS: options.platform || 'android' } };
    if (name === '@react-native-google-signin/google-signin') return sdk;
    throw new Error(`Unexpected import: ${name}`);
  } });
  return { helper: exports.googleSignInIdToken, calls };
}
for (const app of ['customer-app', 'merchant-app', 'rider-app']) {
  test(`${app}: EAS profiles use the registered package and iOS client`, () => {
    const directory = path.join(__dirname, '../apps', app);
    const base = JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'));
    const eas = JSON.parse(fs.readFileSync(path.join(directory, 'eas.json'), 'utf8'));
    const example = require('node:util').parseEnv(fs.readFileSync(path.join(directory, '.env.example'), 'utf8'));
    const packageName = `pk.sirfbazar.${app.replace('-app', '')}`;
    assert.equal(eas.build['release-keystore'].extends, 'preview');
    assert.equal(eas.build['release-keystore'].android.credentialsSource, 'local');
    assert.equal(eas.build.preview.android.buildType, 'apk');
    assert.equal(eas.build.preview.distribution, 'internal');
    assert.equal(base.expo.android.package, packageName);
    assert.equal(base.expo.ios.bundleIdentifier, packageName);
    assert.equal(example.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, webClientId);
    assert.equal(example.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, registeredIosClients[app]);
    for (const profile of ['development', 'preview', 'production']) {
      const env = eas.build[profile].env;
      assert.equal(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, webClientId, profile);
      assert.equal(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, registeredIosClients[app], profile);
      const module = { exports: {} };
      vm.runInNewContext(fs.readFileSync(path.join(directory, 'app.config.js'), 'utf8'), {
        module, require: () => base, structuredClone, URL,
        process: { env: { ...env, EAS_BUILD_PLATFORM: 'ios' } },
      });
      const config = module.exports.expo;
      assert.equal(config.android.package, packageName);
      assert.equal(config.ios.bundleIdentifier, packageName);
      assert.equal(config.plugins.find(p => Array.isArray(p) && p[0].includes('google-signin'))[1].iosUrlScheme,
        registeredIosClients[app].split('.').reverse().join('.'));
    }
  });
  test(`${app}: native ID token, account chooser and explicit audience`, async () => {
    const f = load(app, { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' } });
    assert.equal(await f.helper(), 'signed-token');
    assert.deepEqual(f.calls.map(c => c[0]), ['configure', 'playServices', 'signOut', 'signIn']);
    assert.equal(f.calls[0][1].webClientId, 'web.apps.googleusercontent.com');
    assert.equal(f.calls[0][1].offlineAccess, false);
  });
  test(`${app}: cancellation, repeated tap and legacy cancellation are no-ops`, async () => {
    assert.equal(await load(app, { response: { type: 'cancelled', data: null } }).helper(), null);
    assert.equal(await load(app, { error: { code: 'cancelled' } }).helper(), null);
    const f = load(app);
    const first = f.helper();
    assert.equal(await f.helper(), null);
    assert.equal(await first, 'signed-token');
  });
  test(`${app}: errors reset single-flight guard and missing Play services is actionable`, async () => {
    const f = load(app, { error: { code: 'missing-play' } });
    await assert.rejects(f.helper(), /Update Google Play services/);
    await assert.rejects(f.helper(), /Update Google Play services/);
    await assert.rejects(load(app, { response: { type: 'success', data: { idToken: null } } }).helper(), /did not return/);
  });
  test(`${app}: iOS requires its own client and does not call Play services`, async () => {
    await assert.rejects(load(app, { platform: 'ios' }).helper(), /unavailable in this iOS build/);
    const f = load(app, { platform: 'ios', env: { EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com' } });
    assert.equal(await f.helper(), 'signed-token');
    assert.equal(f.calls[0][1].iosClientId, 'ios.apps.googleusercontent.com');
    assert.ok(!f.calls.some(c => c[0] === 'playServices'));
  });
  test(`${app}: Expo preserves existing settings and derives the iOS URL scheme`, () => {
    const file = path.join(__dirname, `../apps/${app}/app.config.js`);
    const base = JSON.parse(fs.readFileSync(path.join(__dirname, `../apps/${app}/app.json`), 'utf8'));
    function config(env) {
      const module = { exports: {} };
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, require: () => base, structuredClone, URL, process: { env } });
      return module.exports.expo;
    }
    const configured = config({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '123-ios.apps.googleusercontent.com' });
    assert.equal(configured.android.package, base.expo.android.package);
    assert.equal(configured.ios.bundleIdentifier, base.expo.ios.bundleIdentifier);
    assert.equal(configured.plugins.find(p => Array.isArray(p) && p[0].includes('google-signin'))[1].iosUrlScheme, 'com.googleusercontent.apps.123-ios');
    assert.throws(() => config({ EAS_BUILD_PLATFORM: 'ios' }), /Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/);
    assert.throws(() => config({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'invalid' }), /OAuth iOS client/);
    assert.ok(base.expo.plugins.includes('@react-native-google-signin/google-signin'), 'base configuration must not be mutated');
  });
}
