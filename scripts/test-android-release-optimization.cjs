const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

for (const role of ['customer', 'merchant', 'rider']) {
  const app = path.join(root, 'apps', `${role}-app`);
  const source = fs.readFileSync(path.join(app, 'plugins/withAndroidReleaseOptimization.js'), 'utf8');
  const module = { exports: {} };
  const mods = {};
  vm.runInNewContext(source, { module, require: () => ({
    withGradleProperties: (config, mod) => { mods.properties = mod; return config; },
    withAppBuildGradle: (config, mod) => { mods.gradle = mod; return config; },
  }) });
  module.exports({});

  test(`${role}: standalone prebuild includes the release optimizer`, () => {
    const base = JSON.parse(fs.readFileSync(path.join(app, 'app.json'), 'utf8')).expo;
    assert.ok(base.plugins.includes('./plugins/withAndroidReleaseOptimization'));
    assert.equal(base.android.package, `pk.sirfbazar.${role}`);
  });

  test(`${role}: release flags replace stale values without changing debug or other settings`, () => {
    const result = mods.properties({ modResults: [
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
      { type: 'property', key: 'hermesEnabled', value: 'true' },
    ] });
    mods.properties(result);
    for (const key of ['android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds']) {
      const values = result.modResults.filter(item => item.key === key);
      assert.equal(values.length, 1);
      assert.equal(values[0].value, 'true');
    }
    assert.equal(result.modResults.find(item => item.key === 'hermesEnabled').value, 'true');
    assert.equal(result.modResults.length, 3);
  });

  test(`${role}: optimized ProGuard defaults survive repeated prebuild`, () => {
    const contents = 'debug { signingConfig signingConfigs.debug }\nrelease { proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro" }';
    const result = mods.gradle({ modResults: { language: 'groovy', contents } });
    assert.match(result.modResults.contents, /proguard-android-optimize\.txt/);
    assert.ok(result.modResults.contents.includes('debug { signingConfig signingConfigs.debug }'));
    assert.ok(result.modResults.contents.includes('"proguard-rules.pro"'));
    const once = result.modResults.contents;
    mods.gradle(result);
    assert.equal(result.modResults.contents, once);
  });

  test(`${role}: unsupported native templates fail instead of silently disabling optimization`, () => {
    assert.throws(() => mods.gradle({ modResults: { language: 'kotlin', contents: '' } }), /Review the Android release/);
    assert.throws(() => mods.gradle({ modResults: { language: 'groovy', contents: 'release {}' } }), /Review the Android release/);
  });
}
