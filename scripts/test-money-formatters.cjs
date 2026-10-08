// Execute the actual exported money functions in isolation from transport imports.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/pos/node_modules/typescript');

const cases = [
  ['apps/web/lib/format.ts', 'formatPKR'],
  ['apps/admin/src/lib/api.ts', 'pkr'],
  ['apps/pos/src/lib/api.ts', 'pkr'],
  ['apps/shop/src/lib/api.ts', 'pkr'],
  ['apps/merchant-app/lib/api.ts', 'pkr'],
  ['apps/rider-app/lib/api.ts', 'pkr'],
];
const expected = new Map([[1, 'Rs 0.01'], [49, 'Rs 0.49'], [50, 'Rs 0.50'],
  [99, 'Rs 0.99'], [100, 'Rs 1'], [10050, 'Rs 100.50']]);

for (const [file, name] of cases) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
  const declaration = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `${file} exports ${name}`);
  const isolated = declaration.getText(parsed);
  const compiled = ts.transpileModule(isolated, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, Number }, { filename: file });
  const format = module.exports[name];
  for (const [paisa, text] of expected) assert.equal(format(paisa), text, `${file}: ${paisa} paisa`);
}
process.stdout.write(`Exact paisa formatting: ${cases.length * expected.size} behavioral cases passed.\n`);
