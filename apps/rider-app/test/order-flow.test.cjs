const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const flow = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/rider-orders.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: flow });
test('reserved preparing deliveries remain visible but are waiting for packing', () => {
  for (const status of ['MERCHANT_ACCEPTED', 'PREPARING']) {
    assert.equal(flow.isActive(status), true); assert.equal(flow.waitingForPacking(status), true);
  }
  for (const status of ['RIDER_ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED_BY_ADMIN']) assert.equal(flow.waitingForPacking(status), false);
  assert.equal(flow.isActive('DELIVERED'), false); assert.equal(flow.isActive('CANCELLED_BY_ADMIN'), false);
});

test('delivery focus checks location without reopening Android permission dialogs', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../screens/RiderDeliveryScreen.tsx'), 'utf8');
  assert.match(screen, /await Location\.getForegroundPermissionsAsync\(\)/);
  assert.doesNotMatch(screen, /Location\.requestForegroundPermissionsAsync/);
  assert.match(screen, /permission\.status !== 'granted'/);
  assert.match(screen, /stopped \|\| generation !== getAuthVersion\(\)/);
  assert.match(screen, /subscription\?\.remove\(\)/);
  const settings = fs.readFileSync(path.join(__dirname, '../screens/RiderPermissionsScreen.tsx'), 'utf8');
  assert.match(settings, /await Location\.requestForegroundPermissionsAsync\(\)/);
  assert.doesNotMatch(settings, /GPS sharing is not active|does not send live GPS/);
});

function locationEffect(permission) {
  const source = fs.readFileSync(path.join(__dirname, '../screens/RiderDeliveryScreen.tsx'), 'utf8');
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
        node.arguments[0].getText(ast).includes('Location.getForegroundPermissionsAsync')) callback = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback, 'exercise the actual active-delivery location effect');
  const state = { watches: 0, removed: 0, posts: [], errors: [], generation: 1, position: null };
  const context = {
    exports: {}, focused: true, appActive: true, order: { id: 'review-order', status: 'ON_THE_WAY' },
    step: 'on-way', id: 'review-order', getAuthVersion: () => state.generation,
    setLocationError: value => state.errors.push(value), AppState: { currentState: 'active' },
    api: { post: async (...args) => { state.posts.push(args); } },
    Location: { getForegroundPermissionsAsync: async () => await permission, Accuracy: { Balanced: 3 },
      watchPositionAsync: async (_, onPosition) => {
        state.watches++; state.position = onPosition; return { remove: () => state.removed++ };
      } },
  };
  const code = `exports.run = ${callback.getText(ast)};`;
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { state, context, stop: context.exports.run() };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('denied delivery location never starts tracking or uploads coordinates', async () => {
  const { state, stop } = locationEffect({ status: 'denied' });
  await settle();
  assert.equal(state.watches, 0); assert.equal(state.posts.length, 0);
  assert.match(state.errors[0], /Location permission is off/); stop();
});

test('granted delivery location stops uploads on background, account change and cleanup', async () => {
  const { state, context, stop } = locationEffect({ status: 'granted' });
  await settle();
  assert.equal(state.watches, 1);
  const position = { coords: { latitude: 31.5, longitude: 74.3 } };
  state.position(position); assert.equal(state.posts.length, 1);
  assert.equal(state.posts[0][0], '/rider/location');
  assert.equal(state.posts[0][1].orderId, 'review-order');
  context.AppState.currentState = 'background'; state.position(position);
  context.AppState.currentState = 'active'; state.generation++; state.position(position);
  state.generation--; stop(); state.position(position);
  assert.equal(state.posts.length, 1); assert.equal(state.removed, 1);
});

test('leaving while the permission read is pending never starts a watcher', async () => {
  let resolve;
  const { state, stop } = locationEffect(new Promise(done => { resolve = done; }));
  stop(); resolve({ status: 'granted' }); await settle();
  assert.equal(state.watches, 0); assert.equal(state.posts.length, 0);
});
