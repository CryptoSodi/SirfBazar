const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const directory = path.join(__dirname, '../apps/merchant-app');
const base = JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'));
const source = fs.readFileSync(path.join(directory, 'app.config.js'), 'utf8');
const key = 'AIza' + 'x'.repeat(35);
function config(env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, structuredClone, URL, require: () => base, process: { env } });
  return module.exports.expo;
}
test('merchant has no hardcoded Maps key and preserves package and FCM', () => {
  assert.equal(base.expo.android.config?.googleMaps?.apiKey, undefined);
  const result = config({ EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: key });
  assert.equal(result.android.config.googleMaps.apiKey, key);
  assert.equal(result.android.package, 'pk.sirfbazar.merchant');
  assert.equal(result.android.googleServicesFile, base.expo.android.googleServicesFile);
  assert.equal(base.expo.android.config?.googleMaps?.apiKey, undefined);
});
test('merchant release refuses absent or invalid native Maps keys', () => {
  const release = { EAS_BUILD_PLATFORM: 'android', NODE_ENV: 'production' };
  assert.throws(() => config(release), /Configure EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY/);
  assert.throws(() => config({ ...release, EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: 'invalid' }), /valid Android-restricted/);
  assert.equal(config({ ...release, EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: ` ${key} ` }).android.config.googleMaps.apiKey, key);
});
test('isolated builds do not embed the production merchant key', () => {
  const result = config({ REMEDIATION_TEST_BUILD: '1', EAS_BUILD_PLATFORM: 'android', NODE_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'http://localhost:3001/api', EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: key });
  assert.equal(result.android.package, 'pk.sirfbazar.merchant.remediation');
  assert.equal(result.android.config?.googleMaps, undefined);
});
