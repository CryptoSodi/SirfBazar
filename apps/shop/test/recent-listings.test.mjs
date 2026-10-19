import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/recent-listings.ts', import.meta.url), 'utf8')
  .replace("import type { MerchantListing, Paged } from './merchant-contracts';", '');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { withRecentListings } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const listing = (id) => ({ id, product: { id, name: id }, pricePaisa: 100, stockQuantity: 1, lowStockThreshold: 5, isAvailable: true });
const page = (items, total = items.length) => ({ items, total, page: 1, pageSize: 2, totalPages: Math.max(1, Math.ceil(total / 2)) });

test('shows a confirmed product immediately at the top of the shop list', () => {
  const result = withRecentListings(page([listing('old-1'), listing('old-2')], 5), [listing('new')]);
  assert.deepEqual(result.items.map((item) => item.id), ['new', 'old-1']);
  assert.equal(result.total, 6);
  assert.equal(result.totalPages, 3);
});

test('does not duplicate a product once the server includes it', () => {
  const result = withRecentListings(page([listing('new'), listing('old')], 2), [listing('new')]);
  assert.deepEqual(result.items.map((item) => item.id), ['new', 'old']);
  assert.equal(result.total, 2);
});

test('preserves multiple recently created products while a stale page catches up', () => {
  const result = withRecentListings(page([listing('old')]), [listing('new-2'), listing('new-1')]);
  assert.deepEqual(result.items.map((item) => item.id), ['new-2', 'new-1']);
  assert.equal(result.total, 3);
});
