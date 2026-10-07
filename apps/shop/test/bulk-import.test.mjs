import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/bulk-import.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const csv = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('CSV handles BOM, CRLF, quoted commas, escaped quotes and embedded newlines', () => {
  assert.deepEqual(csv.parseCsv('\uFEFFSKU,Name,Sale,Stock\r\n00123,"Rice, premium",650.50,20\r\n00456,"A ""special""\nitem",20,1'), [
    ['SKU', 'Name', 'Sale', 'Stock'], ['00123', 'Rice, premium', '650.50', '20'], ['00456', 'A "special"\nitem', '20', '1'],
  ]);
});

test('mapping preserves leading zeros and calculates paisa exactly', () => {
  const rows = csv.parseCsv('Code,Name,Sale,Units\n0000123,Milk,290.05,3');
  assert.deepEqual(csv.mapCsv(rows, { merchantSku: 0, name: 1, priceRupees: 2, stockQuantity: 3 }), [
    { rowId: '2', name: 'Milk', merchantSku: '0000123', pricePaisa: 29005, stockQuantity: 3 },
  ]);
});

test('missing or fractional stock, duplicate identity and unsafe prices fail before upload', () => {
  assert.throws(() => csv.parseStock(''), /whole stock quantity/);
  assert.throws(() => csv.parseStock('1.5'), /whole stock quantity/);
  assert.throws(() => csv.parseRupees('1.999'), /two decimal/);
  assert.throws(() => csv.parseRupees('999999999999999999'), /supported range/);
  assert.throws(() => csv.mapCsv(csv.parseCsv('Code,Sale,Units\n001,10,1\n001,20,2'), { merchantSku: 0, priceRupees: 1, stockQuantity: 2 }), /duplicate product identity/);
  assert.throws(() => csv.mapCsv(csv.parseCsv('ID,Code,Sale,Units\nA,001,10,1\nB,001,20,2'), { productId: 0, merchantSku: 1, priceRupees: 2, stockQuantity: 3 }), /duplicate product identity/);
});

test('malformed and excessive CSV gives a recoverable error', () => {
  assert.throws(() => csv.parseCsv('A,B\n"unclosed,1'), /unclosed quoted/);
  assert.throws(() => csv.parseCsv('A,B\n1,2,3'), /different column counts/);
  assert.throws(() => csv.parseCsv(`A,B\n${'x'.repeat(4097)},1`), /too long/);
  assert.throws(() => csv.parseCsv(`A,B\n${'x,1\n'.repeat(1001)}`), /1,000 rows/);
});
