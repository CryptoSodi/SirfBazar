// Read-only catalogue snapshot for reviewing category assignments. No auth/PII.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const base = 'https://api.sirfbazar.com/api';
  async function read(endpoint) {
    const response = await fetch(base + endpoint, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`${endpoint}: ${response.status}`);
    return response.json();
  }
  const categories = await read('/products/categories');
  const products = [];
  let expected;
  for (let page = 1; ; page++) {
    const result = await read(`/products/catalog?page=${page}&pageSize=100`);
    expected ??= result.total;
    if (result.total !== expected || !Array.isArray(result.items)) throw Error('Catalogue changed; take a new snapshot.');
    products.push(...result.items.map(p => ({ id: p.productId, name: p.name, categoryId: p.categoryId })));
    if (page >= result.totalPages) break;
  }
  if (new Set(products.map(p => p.id)).size !== expected) throw Error('Missing or repeated products; take a new snapshot.');
  const flatten = nodes => nodes.flatMap(c => [{ id: c.id, name: c.name, slug: c.slug, isActive: true, parentCategoryId: c.parentCategoryId ?? null }, ...flatten((c.children ?? []).map(child => ({ ...child, parentCategoryId: c.id })))]);
  const target = path.resolve('output/category-public-snapshot.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ capturedAt: new Date().toISOString(), source: base, categories: flatten(categories), products }, null, 2));
  console.log(JSON.stringify({ file: target, categories: flatten(categories).length, products: products.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
