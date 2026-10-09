require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makePlan, digest } = require('../scripts/category-plan.cjs');
const { taxonomy, classify, definitions } = require('../scripts/category-sections.cjs');
const { categoryBranch } = require('../src/common/utils/category-tree.ts');
const { CatalogService } = require('../src/catalog/catalog.service.ts');
const { CouponsService } = require('../src/coupons/coupons.service.ts');
const root = { id: 'produce', slug: 'fruits-vegetables', name: 'Fruits & Vegetables', isActive: true, isRestricted: true, parentCategoryId: null };
const snapshot = { categories: [root], products: [{ id: 'apple', name: 'Apple Kala Kulu', categoryId: root.id }, { id: 'arvi', name: 'Arvi 500g', categoryId: root.id }] };
const rows = [{ id: 'root', parentCategoryId: null, isActive: true }, { id: 'fruit', parentCategoryId: 'root', isActive: true }, { id: 'apple', parentCategoryId: 'fruit', isActive: true }, { id: 'off', parentCategoryId: 'root', isActive: false }, { id: 'hidden', parentCategoryId: 'off', isActive: true }, { id: 'other', parentCategoryId: null, isActive: true }];

test('taxonomy covers every existing parent and has unique stable subsection slugs', () => {
  assert.equal(Object.keys(taxonomy).length, 26);
  const slugs = Object.keys(taxonomy).flatMap(slug => definitions({ slug, name: slug }).map(c => c.slug));
  assert.equal(new Set(slugs).size, slugs.length);
});
test('produce and meat classify within their parent, with no flavour-based cross-department moves', () => {
  for (const [name, expected] of [['Arvi 500g', 'Fresh Vegetables'], ['Fresh Turmeric', 'Fresh Vegetables'], ['Apple Kala Kulu', 'Fresh Fruits'], ['Water Melon', 'Fresh Fruits']]) assert.equal(classify(root, name).name, expected);
  for (const [name, expected] of [['Beef Mince', 'Beef'], ['Mutton Leg', 'Mutton'], ['Chicken Wings', 'Chicken'], ['Fresh St Strimps Shrimps Small', 'Seafood']]) assert.equal(classify({ slug: 'fresh-meat', name: 'Meat & Seafood' }, name).name, expected);
  assert.equal(classify({ slug: 'beverages', name: 'Beverages' }, 'Apple Juice').name, 'Juices & Fruit Drinks');
  assert.equal(classify({ slug: 'frozen-and-chilled', name: 'Frozen' }, 'Chicken Sausages').name, 'Sausages & Prepared Meats');
});
test('plan preserves IDs/restrictions and only plans category assignment changes', () => {
  const before = JSON.stringify(snapshot), plan = makePlan(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(plan.create.length, 2); assert.equal(plan.moves.length, 2); assert.equal(plan.review.length, 0);
  assert.ok(plan.create.every(c => c.isRestricted && c.parentCategoryId === root.id));
  assert.deepEqual(plan.moves.map(m => m.productId), ['apple', 'arvi']);
  assert.equal(digest(plan), digest(makePlan({ categories: [root], products: [...snapshot.products].reverse() })));
  assert.notEqual(plan.fingerprint, makePlan({ ...snapshot, products: [{ ...snapshot.products[0], name: 'Renamed' }] }).fingerprint);
});
test('re-running after apply is idempotent; unknown names get a reviewable Other subsection', () => {
  const plan = makePlan(snapshot);
  const applied = { categories: [...snapshot.categories, ...plan.create], products: snapshot.products.map(p => ({ ...p, categoryId: plan.moves.find(m => m.productId === p.id).to })) };
  assert.deepEqual(makePlan(applied).moves, []); assert.deepEqual(makePlan(applied).create, []);
  const unknown = makePlan({ ...snapshot, products: [{ id: 'unknown', name: 'Unidentified item', categoryId: root.id }] });
  assert.equal(unknown.review.length, 1); assert.equal(unknown.review[0].subsection, 'Other Fruits & Vegetables');
});
test('conflicting pre-existing subsection is rejected without reparenting or weakening restrictions', () => {
  const child = makePlan(snapshot).create[0];
  assert.throws(() => makePlan({ ...snapshot, categories: [root, { ...child, isRestricted: false }] }), /conflicts/);
});
test('active descendant resolver fails closed on invalid, inactive, orphaned and cyclic ancestry', () => {
  assert.deepEqual(categoryBranch(rows, 'root'), ['root', 'fruit', 'apple']);
  assert.deepEqual(categoryBranch(rows, 'fruit'), ['fruit', 'apple']);
  for (const id of ['off', 'hidden', 'missing']) assert.deepEqual(categoryBranch(rows, id), []);
  assert.deepEqual(categoryBranch([{ id: 'a', parentCategoryId: 'b', isActive: true }, { id: 'b', parentCategoryId: 'a', isActive: true }], 'a'), []);
  assert.deepEqual(categoryBranch([{ id: 'a', parentCategoryId: 'missing', isActive: true }], 'a'), []);
});
test('public catalogue, search, nearby and shop filters all include descendants', async () => {
  let where;
  const db = { category: { findMany: async () => rows }, product: { findMany: async args => { where = args.where; return []; }, count: async () => 0 }, merchantProduct: { findMany: async args => { where = args.where.product; return []; }, count: async () => 0 }, merchant: { findUnique: async () => ({ id: 'shop', approvalStatus: 'APPROVED', isOnline: true, isOpen: true }), findMany: async args => { where = args.where.products?.some.product; return []; } } };
  const service = new CatalogService(db);
  for (const call of [() => service.catalogProducts({ categoryId: 'root' }), () => service.search({ categoryId: 'root' }), () => service.nearbyProducts({ categoryId: 'root' }), () => service.merchantProducts('shop', { categoryId: 'root' }), () => service.nearbyMerchants({ categoryId: 'root' })]) {
    await call(); assert.deepEqual(where.categoryId, { in: ['root', 'fruit', 'apple'] }); assert.equal(where.approvalStatus, 'APPROVED');
  }
  await service.catalogProducts({ categoryId: 'missing' }); assert.deepEqual(where.categoryId, { in: [] });
});
test('parent coupons remain valid for descendants, never unrelated/missing/inactive categories', async () => {
  const db = { category: { findMany: async () => rows }, coupon: { findUnique: async () => ({ id: 'coupon', code: 'FRUIT', isActive: true, startDate: new Date(0), endDate: new Date('2100-01-01'), minimumOrderAmountPaisa: 0, applicableCategoryId: 'root', discountType: 'FIXED', discountValue: 100 }) } };
  const coupons = new CouponsService({}); // Proves validation uses supplied transaction client.
  const ctx = { code: 'FRUIT', subtotalPaisa: 500, merchantIds: ['shop'], categoryIds: ['apple'] };
  assert.equal((await coupons.validate(ctx, db)).discountPaisa, 100);
  for (const categoryIds of [undefined, [], ['other'], ['hidden']]) await assert.rejects(() => coupons.validate({ ...ctx, categoryIds }, db), /not valid for these products/);
});
