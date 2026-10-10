import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as XLSX from 'xlsx';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/bulk-import.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const csv = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function xlsxBytes(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Products');
  const binary = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
}

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

test('common product sheet headings are automatically mapped without treating cost as sale price', () => {
  assert.equal(csv.guessCsvField('Product name'), 'name');
  assert.equal(csv.guessCsvField('Sale price (Rs)'), 'priceRupees');
  assert.equal(csv.guessCsvField('Stock quantity'), 'stockQuantity');
  assert.equal(csv.guessCsvField('Catalogue product ID'), 'productId');
  assert.equal(csv.guessCsvField('SKU or Barcode'), 'merchantSku');
  assert.equal(csv.guessCsvField('Cost price'), undefined);
  assert.equal(csv.guessCsvField('Stock value'), undefined);
});

test('XLSX import reads the first worksheet, preserves text codes and validates row sizes', () => {
  const bytes = xlsxBytes([
    ['Merchant SKU or barcode', 'Product name', 'Sale price (Rs)', 'Stock quantity'],
    ['0000123', 'Rice', '650.00', 20],
  ]);
  const rows = csv.parseXlsxBytes(bytes, XLSX);
  assert.equal(rows[1][0], '0000123');
  assert.deepEqual(csv.mapCsv(rows, { merchantSku: 0, name: 1, priceRupees: 2, stockQuantity: 3 })[0], {
    rowId: '2', name: 'Rice', merchantSku: '0000123', pricePaisa: 65000, stockQuantity: 20,
  });
  assert.throws(() => csv.parseXlsxBytes(xlsxBytes([['A', 'B'], ...Array.from({ length: 1001 }, () => ['x', 1])]), XLSX), /1,000 product rows/);
});

test('XLSX formula cells are rejected instead of importing stale cached results', () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Name', 'Sale price', 'Stock quantity'], ['Rice', 1, 2]]);
  sheet.B2 = { t: 'n', f: '1+1', v: 2 };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
  const binary = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  const bytes = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
  assert.throws(() => csv.parseXlsxBytes(bytes, XLSX), /Formula cells are not supported/);
});

test('CSV parser accepts 10, 100 and 1,000 product rows within the documented cap', () => {
  for (const count of [10, 100, 1000]) {
    const source = ['SKU,Sale price,Stock quantity', ...Array.from({ length: count }, (_, i) => `sku-${i},10,1`)].join('\n');
    assert.equal(csv.parseCsv(source).length, count + 1);
  }
});
