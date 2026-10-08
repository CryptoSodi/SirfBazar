const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../src/lib/browserSession.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const user = (id) => ({ id, role: 'MERCHANT_OWNER', merchant: { id: `shop-${id}` } });
const auth = (id, suffix) => ({ accessToken: `access-${id}-${suffix}`, refreshToken: `refresh-${id}-${suffix}`, user: user(id) });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

function fixture() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  const queues = new Map();
  const locks = { request(name, work) {
    const previous = queues.get(name) || Promise.resolve();
    const task = previous.then(work);
    queues.set(name, task.catch(() => undefined));
    return task;
  } };
  let fetchImpl = async () => response(500);
  let fastTimeout = false;
  function tab(withLocks = true) {
    const exports = {};
    runInNewContext(compiled, {
      exports, localStorage: storage, navigator: withLocks ? { locks } : {},
      crypto: webcrypto, atob, URL, AbortController,
      window: { addEventListener() {}, dispatchEvent() {} }, Event,
      fetch: (...args) => fetchImpl(...args),
      setTimeout: (fn, delay) => setTimeout(fn, fastTimeout && delay === 15000 ? 0 : delay), clearTimeout,
    });
    return exports.browserSession('sbs');
  }
  return { tab, setFetch: (work) => { fetchImpl = work; }, setFastTimeout: (value) => { fastTimeout = value; }, storage };
}

test('two tabs renew once and adopt the same-session winner before storage events', async () => {
  const f = fixture(); const left = f.tab(); const right = f.tab();
  left.write(auth('A', 1));
  const one = left.read(); const two = right.read();
  let calls = 0;
  f.setFetch(async () => { calls++; return response(200, auth('A', 2)); });
  const [first, second] = await Promise.all([left.renew(one, '/auth/refresh-token'), right.renew(two, '/auth/refresh-token')]);
  assert.equal(calls, 1);
  assert.equal(first.access, 'access-A-2');
  assert.equal(second.access, 'access-A-2');
  assert.equal(right.read().refresh, 'refresh-A-2');
});

for (const status of [200, 401]) test(`late old-account refresh ${status} cannot replace or clear B`, async () => {
  const f = fixture(); const left = f.tab(); const right = f.tab();
  left.write(auth('A', 1));
  const pending = deferred();
  f.setFetch(() => pending.promise);
  const renewal = left.renew(left.read(), '/auth/refresh-token');
  await new Promise((resolve) => setTimeout(resolve, 0));
  right.write(auth('B', 1));
  pending.resolve(response(status, auth('A', 2)));
  assert.equal(await renewal, null);
  assert.equal(left.read().user.id, 'B');
  assert.equal(left.read().refresh, 'refresh-B-1');
});

test('stale old-account clear cannot remove another tab’s winner', () => {
  const f = fixture(); const left = f.tab(); const right = f.tab();
  left.write(auth('A', 1)); const captured = left.read();
  right.write(auth('B', 1));
  assert.equal(left.clear(captured), false);
  assert.equal(right.read().user.id, 'B');
});

test('missing Web Locks fails closed without using or clearing refresh credentials', async () => {
  const f = fixture(); const tab = f.tab(false); tab.write(auth('A', 1));
  let calls = 0; f.setFetch(async () => { calls++; return response(200, auth('A', 2)); });
  await assert.rejects(tab.renew(tab.read(), '/auth/refresh-token'), /Secure session renewal/);
  assert.equal(calls, 0);
  assert.equal(tab.read().refresh, 'refresh-A-1');
});

test('timed-out renewal releases cross-tab lock without publishing a late response', async () => {
  const f = fixture(); const left = f.tab(); const right = f.tab();
  left.write(auth('A', 1));
  const pending = deferred(); f.setFetch(() => pending.promise); f.setFastTimeout(true);
  await assert.rejects(left.renew(left.read(), '/auth/refresh-token'), /unavailable/);
  f.setFastTimeout(false);
  f.setFetch(async () => response(200, auth('A', 2)));
  const winner = await right.renew(right.read(), '/auth/refresh-token');
  pending.resolve(response(200, auth('A', 99)));
  assert.equal(winner.access, 'access-A-2');
  assert.equal(left.read().access, 'access-A-2');
});
