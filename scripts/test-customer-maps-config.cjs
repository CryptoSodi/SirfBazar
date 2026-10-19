const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const directory = path.join(__dirname, '../apps/customer-app');
const base = JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'));
const source = fs.readFileSync(path.join(directory, 'app.config.js'), 'utf8');
const testKey = 'AIza' + 'x'.repeat(35);
function config(env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, structuredClone, URL, require: () => base, process: { env } });
  return module.exports.expo;
}
test('customer has no hardcoded native Maps key', () => {
  assert.equal(base.expo.android.config?.googleMaps?.apiKey, undefined);
  assert.equal(config().android.config?.googleMaps?.apiKey, undefined);
});
test('customer Android releases refuse missing and malformed Maps configuration', () => {
  const release = { EAS_BUILD_PLATFORM: 'android', NODE_ENV: 'production' };
  assert.throws(() => config(release), /Configure EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY/);
  assert.throws(() => config({ ...release, EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: 'bad-key' }), /valid Android-restricted/);
});
test('customer release embeds configured key without changing identity or base config', () => {
  const result = config({ EAS_BUILD_PLATFORM: 'android', NODE_ENV: 'production', EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: ` ${testKey} ` });
  assert.equal(result.android.config.googleMaps.apiKey, testKey);
  assert.equal(result.android.package, 'pk.sirfbazar.customer');
  assert.equal(result.android.googleServicesFile, base.expo.android.googleServicesFile);
  assert.equal(base.expo.android.config?.googleMaps?.apiKey, undefined);
});
test('isolated remediation package does not reuse the production Maps key', () => {
  const result = config({ REMEDIATION_TEST_BUILD: '1', EAS_BUILD_PLATFORM: 'android', NODE_ENV: 'production', EXPO_PUBLIC_API_URL: 'http://localhost:3001/api', EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: testKey });
  assert.equal(result.android.package, 'pk.sirfbazar.customer.remediation');
  assert.equal(result.android.config?.googleMaps, undefined);
});
