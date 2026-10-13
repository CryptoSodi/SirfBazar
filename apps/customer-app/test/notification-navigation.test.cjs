const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'components/CustomerUI.tsx'), 'utf8');
const parsed = ts.createSourceFile('CustomerUI.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const goTab = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'goTab');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(goTab.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: moduleObject, exports: moduleObject.exports });

test('cross-tab notification links preserve the account root and input params', () => {
  const calls = [];
  const parent = { getState: () => ({ routeNames: ['ProfileTab'] }), navigate: (...args) => calls.push(args) };
  const child = { getState: () => ({ routeNames: ['Home'] }), getParent: () => parent };
  const params = { screen: 'Notifications' };
  moduleObject.exports.goTab(child, 'ProfileTab', params);
  assert.equal(calls[0][0], 'ProfileTab');
  assert.equal(calls[0][1].screen, 'Notifications');
  assert.equal(calls[0][1].initial, false);
  assert.equal(params.initial, undefined);
});

test('basket and browse aliases preserve their existing destinations', () => {
  const calls = [];
  const nav = { getState: () => ({ routeNames: ['HomeTab', 'CartTab'] }), navigate: (...args) => calls.push(args) };
  moduleObject.exports.goTab(nav, 'BrowseTab');
  moduleObject.exports.goTab(nav, 'CartTab');
  assert.equal(calls[0][0], 'HomeTab'); assert.equal(calls[0][1].screen, 'Browse');
  assert.equal(calls[1][0], 'CartTab'); assert.equal(calls[1][1].screen, 'Cart');
  assert.ok(calls.every(([, params]) => params.initial === false));
});

test('native notification destinations retain their normal tab root', () => {
  const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  assert.match(app, /navigationRef\.navigate\(destination\.screen[^;]+initial: false/s);
});
