const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const states = [];
  let nextState = 0;
  const GoogleMap = function GoogleMap() {};
  const react = {
    useRef: value => ({ current: value }),
    useState: value => { const index = nextState++; states[index] = value; return [value, update => { states[index] = typeof update === 'function' ? update(states[index]) : update; }]; },
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/MapPicker.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const dependencies = { react, 'react-dom': { createPortal: value => value }, '@react-google-maps/api': { GoogleMap, useJsApiLoader: () => ({ isLoaded: true, loadError: null }) }, '@/lib/maps': { GOOGLE_MAPS_API_KEY: 'fixture-only' }, './useModalFocus': { useModalFocus: () => ({ ref: { current: null }, onKeyDown() {} }) }, './AppIcon': { AppIcon() {} }, '@/components/Toast': { ToastMessage() {} } };
  vm.runInNewContext(source, { React: react, module, exports: module.exports, require: name => { if (!(name in dependencies)) throw Error('Unexpected dependency ' + name); return dependencies[name]; }, document: { body: {} } });
  let confirmed;
  const tree = module.exports.MapPicker({ onConfirm: point => { confirmed = point; }, onClose() {} });
  const all = [];
  function visit(node) { if (!node || typeof node !== 'object') return; all.push(node); node.props?.children?.flat(Infinity).forEach(visit); }
  visit(tree);
  const mapNode = all.find(node => node.type === GoogleMap);
  const confirm = all.find(node => node.type === 'button' && node.props.children.includes('Confirm this location'));
  let center = { lat: 30.3753, lng: 69.3451 };
  mapNode.props.onLoad({ getCenter: () => ({ lat: () => center.lat, lng: () => center.lng }), setCenter: point => { center = point; } });
  return { states, map: mapNode.props, confirm: confirm.props, setCenter: point => { center = point; }, confirmed: () => confirmed };
}

test('Google map click marks a choice and confirms the clicked coordinates', () => {
  const f = fixture();
  f.map.onClick({ latLng: { lat: () => 31.61, lng: () => 74.41 } });
  assert.equal(f.states[2], true);
  f.confirm.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.confirmed())), { latitude: 31.61, longitude: 74.41 });
});
test('Google map drag marks a choice and confirmation reads the latest SDK centre', () => {
  const f = fixture();
  f.setCenter({ lat: 31.62, lng: 74.42 });
  f.map.onDragEnd();
  assert.equal(f.states[2], true);
  f.setCenter({ lat: 31.63, lng: 74.43 });
  f.confirm.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.confirmed())), { latitude: 31.63, longitude: 74.43 });
});
