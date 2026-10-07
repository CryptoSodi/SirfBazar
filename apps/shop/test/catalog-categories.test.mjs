import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/catalog-categories.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { categoryPath } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const tree = [
  { id: 'produce', name: 'Fruits & Vegetables', children: [{ id: 'fruit', name: 'Fresh Fruits' }, { id: 'veg', name: 'Fresh Vegetables' }] },
  { id: 'meat', name: 'Meat & Seafood', children: [{ id: 'fish', name: 'Seafood', children: [{ id: 'fresh-fish', name: 'Fresh Fish' }] }] },
];
test('parent and subsection resolve to distinct paths', () => {
  assert.deepEqual(categoryPath(tree, 'produce').map(c => c.id), ['produce']);
  assert.deepEqual(categoryPath(tree, 'fruit').map(c => c.id), ['produce', 'fruit']);
  assert.deepEqual(categoryPath(tree, 'veg').map(c => c.id), ['produce', 'veg']);
});
test('all sections support nested paths without selecting sibling branches', () => {
  assert.deepEqual(categoryPath(tree, 'fresh-fish').map(c => c.id), ['meat', 'fish', 'fresh-fish']);
  assert.deepEqual(categoryPath([tree[0]], 'fish'), []);
});
test('all-products, empty and unknown categories have no fabricated path', () => {
  assert.deepEqual(categoryPath(tree, ''), []);
  assert.deepEqual(categoryPath(tree, 'missing'), []);
  assert.deepEqual(categoryPath([], 'fruit'), []);
});
