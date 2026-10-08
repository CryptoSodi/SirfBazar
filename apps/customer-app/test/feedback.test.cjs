const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(root, 'apps/customer-app/lib/friendly-error.ts'), 'utf8').replace(/\r/g, '');
for (const app of ['customer-app', 'merchant-app', 'rider-app']) {
  test(`${app}: native plain-language policy parity and validation redaction`, () => {
    const input = fs.readFileSync(path.join(root, 'apps', app, 'lib/friendly-error.ts'), 'utf8');
    assert.equal(input.replace(/\r/g, ''), source);
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports });
    const { friendlyError } = module.exports;
    assert.match(friendlyError(['requestId must be a UUID', 'cartId should not be empty'], 400, '/orders'), /basket.*verified/);
    assert.doesNotMatch(friendlyError('cartId must be a string', 400), /cartId|string/);
    assert.doesNotMatch(friendlyError('Prisma credentials', 500), /Prisma|credentials/);
    assert.match(friendlyError('oops', 429), /wait/);
    assert.match(friendlyError('oops', 401), /Sign in/);
    assert.match(friendlyError('oops', 403), /cannot perform/);
    assert.match(friendlyError('Failed to fetch'), /connection/i);
    assert.match(friendlyError('', 409, '/orders', 'QUOTE_CHANGED'), /Review your order/);
    assert.equal(friendlyError('Enter a valid delivery contact number.'), 'Enter a valid delivery contact number.');
    assert.match(friendlyError('Guest session expired'), /guest session expired/);
  });
}
