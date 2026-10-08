const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file) { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports }); return module.exports; }
const source = fs.readFileSync(path.join(root,'apps/web/lib/friendly-error.ts'),'utf8').replace(/\r/g,'');
for (const app of ['web','shop','admin','pos']) {
  const folder = ['shop','admin','pos'].includes(app) ? 'src/lib' : 'lib';
  const file = path.join(root,'apps',app,folder,'friendly-error.ts');
  test(`${app}: plain-language policy parity and validation redaction`, () => {
    assert.equal(fs.readFileSync(file,'utf8').replace(/\r/g,''),source);
    const { friendlyError } = load(file);
    const errors = ['requestId must be a UUID', 'cartId should not be empty', 'cartId must be a string'];
    assert.match(friendlyError(errors,400,'/orders'), /basket.*verified/);
    assert.doesNotMatch(friendlyError(errors.join(', '),400), /UUID|cartId|requestId/);
    assert.doesNotMatch(friendlyError('PrismaClientKnownRequestError: credentials',500), /Prisma|credentials/);
    assert.match(friendlyError('oops',429), /wait/);
    assert.match(friendlyError('oops',401), /Sign in/);
    assert.match(friendlyError('oops',403), /cannot perform/);
    assert.match(friendlyError('Failed to fetch'), /connection/i);
    assert.match(friendlyError('',409,'/orders','QUOTE_CHANGED'), /Review your order/);
    assert.equal(friendlyError('Enter a valid delivery contact number.'), 'Enter a valid delivery contact number.');
    assert.match(friendlyError('Guest session expired'), /guest session expired/);
  });
}
test('category paths select nested children without sibling leakage', () => {
  const { categoryPath, flattenCategories } = load(path.join(root,'apps/web/lib/category-tree.ts'));
  const tree = [{id:'p',slug:'fruit-veg',name:'Fruits & Vegetables',children:[{id:'f',slug:'fruit',name:'Fresh Fruits'},{id:'v',slug:'veg',name:'Fresh Vegetables'}]}];
  assert.deepEqual(Array.from(categoryPath(tree,'veg'), n=>n.id), ['p','v']);
  assert.deepEqual(Array.from(categoryPath(tree,'f'), n=>n.id), ['p','f']);
  assert.equal(categoryPath(tree,'missing').length,0);
  assert.equal(flattenCategories(tree).length,3);
});
