require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { CatalogService } = require('../src/catalog/catalog.service');
const { CartService } = require('../src/cart/cart.service');

function catalogFixture() {
  const shops = [
    { id: 'offline', isOnline: false, isOpen: true },
    { id: 'closed', isOnline: true, isOpen: false },
    { id: 'online', isOnline: true, isOpen: true },
    { id: 'suspended', isOnline: true, isOpen: true, approvalStatus: 'SUSPENDED' },
  ].map(s => ({ shopName: s.id, approvalStatus: 'APPROVED', latitude: 0, longitude: 0, serviceRadiusKm: 5, averagePreparationMinutes: 15, ratingAverage: 4, ...s }));
  const product = { id: 'milk', name: 'Milk', categoryId: 'dairy', approvalStatus: 'APPROVED' };
  const offers = shops.map((merchant, index) => ({ id: `mp-${merchant.id}`, productId: product.id, product, merchantId: merchant.id, merchant, stockQuantity: 5, isAvailable: true, pricePaisa: (index + 1) * 100 }));
  let offerQueries = 0;
  const matches = (s, w = {}) => Object.entries(w).every(([k, v]) => typeof v === 'boolean' || typeof v === 'string' ? s[k] === v : true);
  const db = {
    merchant: { findMany: async ({ where }) => shops.filter(s => matches(s, where)), findUnique: async ({ where }) => shops.find(s => s.id === where.id) },
    merchantProduct: { findMany: async ({ where }) => {
      offerQueries++;
      assert.deepEqual(where.merchant, { approvalStatus: 'APPROVED', isOnline: true, isOpen: true });
      return offers.filter(o => matches(o.merchant, where.merchant) && (!where.merchantId || (typeof where.merchantId === 'string' ? o.merchantId === where.merchantId : where.merchantId.in.includes(o.merchantId))) && (!where.product?.NOT || o.productId !== where.product.NOT.id));
    }, count: async () => 1 },
    product: { findUnique: async () => product, findMany: async () => [product] },
    customer: { findUnique: async () => ({ id: 'fixture-customer' }) },
    orderItem: { groupBy: async () => [{ productId: 'milk' }], findMany: async () => [{ productId: 'milk' }] },
  };
  return { service: new CatalogService(db), shops, queries: () => offerQueries };
}

for (const location of [{}, { latitude: 0, longitude: 0 }]) {
  test(`customer feeds hide offline/closed/suspended offers, with ${'latitude' in location ? 'coordinates' : 'no coordinates'}`, async () => {
    const { service } = catalogFixture();
    for (const response of [await service.search(location), await service.nearbyProducts(location), { items: await service.popularProducts(location) }, { items: await service.recommendedProducts(location) }, { items: await service.recommendedProducts(location, 'fixture-user') }]) {
      assert.deepEqual(response.items.map(i => i.merchant.id), ['online']);
    }
    const detail = await service.productDetail('milk', location);
    assert.deepEqual(detail.offers.map(i => i.merchant.id), ['online']);
    assert.deepEqual(detail.similar, []);
    const directory = await service.nearbyMerchants(location);
    assert.deepEqual(directory.items.map(s => s.id).sort(), ['closed', 'offline', 'online']);
    assert.equal(directory.items.find(s => s.id === 'offline').isOnline, false);
  });
}

test('direct offline/closed shop inventory is empty but shop identity stays discoverable', async () => {
  const f = catalogFixture();
  for (const id of ['offline', 'closed']) {
    assert.equal((await f.service.merchantDetail(id, {})).id, id);
    const page = await f.service.merchantProducts(id, { page: 2, pageSize: 24 });
    assert.deepEqual(page.items, []); assert.equal(page.total, 0); assert.equal(page.page, 2);
  }
  assert.equal(f.queries(), 0);
  await assert.rejects(f.service.merchantProducts('suspended', {}), /Merchant not found/);
  f.shops[0].isOnline = true;
  assert.equal((await f.service.merchantProducts('offline', {})).items.length, 1);
});

test('offline-only products disappear and return only after the shop is online and open', async () => {
  const f = catalogFixture();
  f.shops.find(s => s.id === 'online').isOnline = false;
  assert.deepEqual((await f.service.search({})).items, []);
  assert.deepEqual((await f.service.productDetail('milk', {})).offers, []);
  f.shops.find(s => s.id === 'offline').isOnline = true;
  assert.deepEqual((await f.service.search({})).items.map(i => i.merchant.id), ['offline']);
});

function cartFixture(isOnline, isOpen) {
  let quantity = 2, writes = 0;
  const tx = {
    $queryRaw: async () => [{ id: 'locked-owner' }],
    cart: { findFirst: async ({ where }) => where.status === 'MERGED' ? null : ({ id: 'cart' }), update: async () => {} },
    merchantProduct: { findUnique: async () => ({ id: 'mp', merchantId: 'shop', productId: 'milk', isAvailable: true, stockQuantity: 20, pricePaisa: 100, merchant: { shopName: 'Fixture Shop', approvalStatus: 'APPROVED', isOnline, isOpen }, product: { approvalStatus: 'APPROVED' } }) },
    cartItem: { findFirst: async ({ where }) => where.cartId === 'cart' && where.id === 'item' ? { id: 'item', quantity, merchantProductId: 'mp' } : null, findUnique: async () => ({ id: 'item', quantity }), update: async ({ data }) => { quantity = data.quantity; writes++; }, create: async () => { writes++; }, delete: async () => { quantity = 0; writes++; }, deleteMany: async ({ where }) => { assert.equal(where.cartId, 'cart'); quantity = 0; writes++; } },
  };
  const service = new CartService({ $transaction: op => op(tx) }, {}, {});
  service.viewInTransaction = async () => ({ quantity });
  return { service, quantity: () => quantity, writes: () => writes };
}

for (const owner of [{ customerId: 'customer' }, { guestSessionId: 'guest' }]) {
  for (const [isOnline, isOpen] of [[false, true], [true, false]]) {
    test(`unavailable shop rejects additions/increases, retains removal and reductions (${JSON.stringify(owner)}, ${isOnline}/${isOpen})`, async () => {
      const f = cartFixture(isOnline, isOpen);
      await assert.rejects(f.service.addItem(owner, 'mp', 1), /not accepting orders right now/);
      await assert.rejects(f.service.updateItem(owner, 'item', 3), /not accepting orders right now/);
      assert.equal(f.writes(), 0); assert.equal(f.quantity(), 2);
      await f.service.updateItem(owner, 'item', 1); assert.equal(f.quantity(), 1);
      await f.service.removeItem(owner, 'item'); assert.equal(f.quantity(), 0);
    });
  }
}
test('online/open cart additions and increases remain supported', async () => {
  const f = cartFixture(true, true);
  await f.service.addItem({ customerId: 'customer' }, 'mp', 1); assert.equal(f.quantity(), 3);
  await f.service.updateItem({ customerId: 'customer' }, 'item', 4); assert.equal(f.quantity(), 4);
});
