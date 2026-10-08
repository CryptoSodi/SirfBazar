const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../lib/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const auth = (id) => ({ accessToken: `access-${id}`, refreshToken: `refresh-${id}`, user: { id, role: 'RIDER', rider: { id: `rider-${id}` } } });

function fixture() {
  const values = new Map();
  let holdWrite = null;
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    multiSet: async (pairs) => { if (holdWrite) await holdWrite.promise; pairs.forEach(([key, value]) => values.set(key, value)); },
    multiRemove: async (keys) => keys.forEach((key) => values.delete(key)),
    setItem: async (key, value) => values.set(key, value),
  };
  let fetchImpl = async () => response(500, {});
  const exports = {};
  const imports = {
    './friendly-error': { friendlyError: (message) => message || 'Request failed' },
    './toast-session': { invalidateSessionToasts() {} },
    '@react-native-async-storage/async-storage': storage,
  };
  runInNewContext(compiled, {
    exports, require: (id) => { if (!(id in imports)) throw Error(`Unexpected module ${id}`); return imports[id]; },
    process: { env: { EXPO_PUBLIC_API_URL: 'http://fixture.test/api' } },
    fetch: (...args) => fetchImpl(...args),
    setTimeout, clearTimeout, AbortController,
  });
  return { api: exports, values, setFetch: (work) => { fetchImpl = work; }, holdWrites: () => { holdWrite = deferred(); return holdWrite; } };
}

test('request begun while B persistence is pending never sends A credentials', async () => {
  const f = fixture(); await f.api.storeAuth(auth('A'));
  const gate = f.holdWrites();
  const saving = f.api.storeAuth(auth('B'));
  let bearer;
  f.setFetch(async (_url, init) => { bearer = init.headers.authorization; return response(200, { owner: 'B' }); });
  const request = f.api.api.get('/rider/profile');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(bearer, undefined, 'read waits behind the pending auth write');
  gate.resolve(); await saving;
  assert.deepEqual(await request, { owner: 'B' });
  assert.equal(bearer, 'Bearer access-B');
});

for (const status of [200, 401]) test(`late A response ${status} cannot publish or refresh as B`, async () => {
  const f = fixture(); await f.api.storeAuth(auth('A'));
  const pending = deferred(); let refreshes = 0;
  f.setFetch((url) => { if (url.endsWith('/auth/refresh-token')) refreshes++; return pending.promise; });
  const old = f.api.api.get('/rider/profile');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await f.api.storeAuth(auth('B'));
  pending.resolve(response(status, { owner: 'A' }));
  await assert.rejects(old, /session changed/i);
  assert.equal(refreshes, 0);
  assert.equal((await f.api.getUser()).id, 'B');
});
