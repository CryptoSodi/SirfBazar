const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

for (const role of ['merchant', 'rider']) {
  const root = path.resolve(__dirname, `../apps/${role}-app`);
  let ts;
  try { ts = createRequire(path.join(root, 'package.json'))('typescript'); }
  catch { ts = createRequire(path.resolve(__dirname, '../apps/api/package.json'))('typescript'); }
  const source = fs.readFileSync(path.join(root, 'lib/notification-navigation.ts'), 'utf8');
  function harness() {
    let generation = 1, owner = 'review-user', ready = true, allowed = true, listener, initial = null;
    let lookup = async id => ({ id: id.split('/').pop() });
    const opened = [], requests = [];
    let clears = 0, removed = 0;
    const module = { exports: {} };
    const response = (overrides = {}, identifier = 'notification-1') => ({ notification: { request: {
      identifier, content: { data: { audience: role.toUpperCase(), scopeId: 'review-scope',
        type: role === 'merchant' ? 'NEW_ORDER' : 'RIDER_ASSIGNED', referenceId: 'order-1', ...overrides } },
    } } });
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { module, exports: module.exports, require(name) {
        if (name === 'react-native') return { Platform: { OS: 'android' } };
        if (name === './api') return { getAuthVersion: () => generation, getUser: async () => owner ? { id: owner } : null,
          api: { get: async url => { requests.push(url); return lookup(url); } } };
        if (name === './push') return { canReceivePush: async data => allowed && data.scopeId === 'review-scope' };
        if (name === 'expo-notifications') return {
          addNotificationResponseReceivedListener: fn => { listener = fn; return { remove() { removed++; } }; },
          getLastNotificationResponseAsync: async () => initial,
          clearLastNotificationResponseAsync: async () => { clears++; },
        };
        throw new Error(`Unexpected dependency ${name}`);
      } });
    const navigation = module.exports.createOrderPushNavigation({ isReady: () => ready, openOrder: id => opened.push(id) });
    return { navigation, response, opened, requests,
      setReady: value => { ready = value; }, setAllowed: value => { allowed = value; },
      changeAccount: () => { generation++; owner = 'other-user'; }, logout: () => { generation++; owner = null; },
      lookup: fn => { lookup = fn; }, initial: value => { initial = value; },
      emit: value => listener(value), counts: () => ({ clears, removed }) };
  }
  test(`${role}: warm notification verifies API ownership and opens once`, async () => {
    const h = harness();
    await Promise.all([h.navigation.receive(h.response()), h.navigation.receive(h.response())]);
    assert.deepEqual(h.opened, ['order-1']);
    assert.ok(h.requests.every(url => url === `/${role}/orders/order-1`));
  });
  test(`${role}: cold response waits for navigation readiness and is cleared`, async () => {
    const h = harness(); h.setReady(false); h.initial(h.response());
    const stop = h.navigation.start(); await new Promise(setImmediate);
    assert.deepEqual(h.opened, []); h.setReady(true); await h.navigation.flush();
    assert.deepEqual(h.opened, ['order-1']); assert.equal(h.counts().clears, 1);
    stop(); assert.equal(h.counts().removed, 1);
  });
  test(`${role}: wrong audience, scope, malformed ID and unrelated types are ignored`, async () => {
    const h = harness();
    for (const payload of [{ audience: 'CUSTOMER' }, { scopeId: 'another-tenant' }, { referenceId: '../other' }, { type: 'SUPPORT_REPLY' }]) {
      await h.navigation.receive(h.response(payload));
    }
    assert.equal(h.requests.length, 0); assert.equal(h.opened.length, 0);
  });
  test(`${role}: queued notifications cannot survive an account switch or logout`, async () => {
    for (const action of ['changeAccount', 'logout']) {
      const h = harness(); h.setReady(false); await h.navigation.receive(h.response());
      h[action](); h.setReady(true); await h.navigation.flush();
      assert.equal(h.opened.length, 0); assert.equal(h.requests.length, 0);
    }
  });
  test(`${role}: expired/reassigned/offline orders never navigate`, async () => {
    for (const result of ['error', 'wrong-id']) {
      const h = harness(); h.lookup(async () => { if (result === 'error') throw new Error('403 or offline'); return { id: 'other-order' }; });
      await h.navigation.receive(h.response()); assert.equal(h.opened.length, 0);
    }
  });
  test(`${role}: session change or unmount during order lookup cancels navigation`, async () => {
    for (const action of ['changeAccount', 'logout', 'stop']) {
      const h = harness(); let resolve;
      h.lookup(() => new Promise(done => { resolve = done; })); const stop = h.navigation.start();
      const pending = h.navigation.receive(h.response()); await new Promise(setImmediate);
      if (action === 'stop') stop(); else h[action]();
      resolve({ id: 'order-1' }); await pending; assert.equal(h.opened.length, 0);
    }
  });
  test(`${role}: revoked permission after lookup and duplicate taps are safe`, async () => {
    const h = harness(); h.lookup(async () => { h.setAllowed(false); return { id: 'order-1' }; });
    await h.navigation.receive(h.response()); assert.equal(h.opened.length, 0);
  });
  test(`${role}: app wires the listener and navigation-ready flush`, () => {
    const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
    assert.match(app, /pushNavigation\.start\(\)/);
    assert.match(app, /onReady=\{\(\) => \{ void pushNavigation\.flush\(\); \}\}/);
    assert.ok(app.includes(`navigationRef.navigate('${role === 'merchant' ? 'OrderDetail' : 'Delivery'}', { orderId })`));
  });
}
