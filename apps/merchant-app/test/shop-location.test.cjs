const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/shop-location.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleObject, exports: moduleObject.exports });
const { isShopPoint, parseShopPoint } = moduleObject.exports;

test('shop pins validate both coordinate types and geographic bounds', () => {
  for (const point of [null, {}, { latitude: '31', longitude: 74 }, { latitude: NaN, longitude: 74 },
    { latitude: 31, longitude: Infinity }, { latitude: 91, longitude: 74 }, { latitude: 31, longitude: -181 }]) assert.equal(isShopPoint(point), false);
  for (const point of [{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }, { latitude: 31.5204, longitude: 74.3587 }]) assert.equal(isShopPoint(point), true);
});
test('manual coordinate selection accepts zero but never treats blank input as zero', () => {
  assert.equal(parseShopPoint('', '74'), null);
  assert.equal(parseShopPoint('31', ' '), null);
  assert.equal(parseShopPoint('bad', '74'), null);
  assert.equal(parseShopPoint('91', '74'), null);
  assert.equal(parseShopPoint('31', '181'), null);
  assert.equal(JSON.stringify(parseShopPoint('0', '0')), JSON.stringify({ latitude: 0, longitude: 0 }));
  assert.equal(JSON.stringify(parseShopPoint(' 31.5204 ', '74.3587')), JSON.stringify({ latitude: 31.5204, longitude: 74.3587 }));
});
test('onboarding opens the native map, confirms only explicit pins and preserves identity upload', () => {
  const source = fs.readFileSync(path.join(__dirname, '../screens/OnboardScreen.tsx'), 'utf8');
  assert.match(source, /ShopMapPicker initial=\{coords\}/);
  assert.match(source, /onConfirm=\{\(point\) => \{ setCoords\(point\)/);
  assert.match(source, /if \(!coords\)/);
  assert.match(source, /uploadMerchantIdentity/);
  const picker = fs.readFileSync(path.join(__dirname, '../components/ShopMapPicker.tsx'), 'utf8');
  assert.match(picker, /isShopPoint\(initial\) \? initial : null/);
  assert.match(picker, /onRequestClose=\{onClose\}/);
  assert.match(picker, /onDragEnd=/);
  assert.match(picker, /request !== generation.current/);
  assert.match(picker, /Promise.race/);
  assert.match(picker, /disabled=\{!point \|\| locating\}/);
});
