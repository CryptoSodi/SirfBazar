const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const role of ['customer', 'merchant', 'rider']) {
  const directory = path.join(__dirname, '..', 'apps', `${role}-app`);
  const base = JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'));
  const source = fs.readFileSync(path.join(directory, 'app.config.js'), 'utf8');
  const resolve = env => {
    const module = { exports: {} };
    vm.runInNewContext(source, {
      module, require: name => {
        assert.equal(name, './app.json');
        return base;
      }, structuredClone, URL, process: { env },
    });
    return module.exports.expo;
  };

  test(`${role}: production Firebase config matches the registered package`, () => {
    const expo = resolve({ EAS_BUILD_PLATFORM: 'android' });
    assert.equal(expo.android.googleServicesFile, './google-services.json');
    assert.ok(expo.plugins.includes('expo-notifications'));
    const config = JSON.parse(fs.readFileSync(path.join(directory, expo.android.googleServicesFile), 'utf8'));
    assert.equal(config.project_info.project_id, 'sirfbazar-notifications');
    assert.equal(config.project_info.project_number, '209308494306');
    assert.equal(config.configuration_version, '1');
    assert.equal(config.private_key, undefined, 'Never bundle a private service-account key');
    assert.notEqual(config.type, 'service_account');
    const clients = config.client.filter(client =>
      client.client_info.android_client_info.package_name === expo.android.package);
    assert.equal(clients.length, 1);
    assert.equal(expo.android.package, `pk.sirfbazar.${role}`);
    assert.match(clients[0].client_info.mobilesdk_app_id, /^1:209308494306:android:/);
    assert.ok(clients[0].api_key.some(key => typeof key.current_key === 'string' && key.current_key.length > 20));
    assert.deepEqual(clients[0].oauth_client, [], 'Push-only project must not replace existing OAuth clients');
  });

  test(`${role}: isolated remediation builds do not use production FCM`, () => {
    const expo = resolve({ REMEDIATION_TEST_BUILD: '1', EXPO_PUBLIC_API_URL: 'http://localhost:3001/api' });
    assert.equal(expo.android.package, `pk.sirfbazar.${role}.remediation`);
    assert.equal(expo.android.googleServicesFile, undefined);
    assert.equal(base.expo.android.googleServicesFile, './google-services.json', 'Base config must not be mutated');
  });
}
