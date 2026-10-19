const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MerchantProductsService } = require('../src/merchant/merchant-products.service.ts');

function createService(merchantId = 'merchant-a') {
  const access = {
    async merchantContext() { return { merchantId }; },
    requirePermission() {},
  };
  const service = new MerchantProductsService({}, access);
  service.previewRows = async (_merchantId, dto) => dto.items.map((item) => ({
    rowId: item.rowId,
    status: 'NEW',
    new: { pricePaisa: item.pricePaisa, stockQuantity: item.stockQuantity },
  }));
  return service;
}

function request(count) {
  return {
    requestId: `import-${count}`,
    mode: 'ADD_MISSING',
    items: Array.from({ length: count }, (_, index) => ({
      rowId: String(index + 2),
      name: `Product ${index + 1}`,
      categoryId: 'category-a',
      unit: 'piece',
      pricePaisa: 100,
      stockQuantity: 1,
    })),
  };
}

test('bulk import preview accepts 10, 100 and 1,000 validated rows', async () => {
  const service = createService();
  for (const count of [10, 100, 1000]) {
    const dto = request(count);
    const preview = await service.bulkPreview('user-a', dto);
    assert.equal(preview.rows.length, count);
    assert.ok(preview.previewToken);
  }
});

test('bulk import rejects over 1,000 rows before preview work', async () => {
  const service = createService();
  let previewCalls = 0;
  service.previewRows = async () => { previewCalls++; return []; };
  await assert.rejects(service.bulkPreview('user-a', request(1001)), /Import must contain 1–1000 rows/);
  assert.equal(previewCalls, 0);
});

test('signed preview tokens are bound to the merchant scope', async () => {
  const dto = request(1);
  const preview = await createService('merchant-a').bulkPreview('user-a', dto);
  await assert.rejects(
    createService('merchant-b').bulkUpload('user-b', { ...dto, previewToken: preview.previewToken }),
    /Import preview expired or changed/,
  );
});

test('missing or duplicate row identities and invalid price or stock fail before preview', async () => {
  const service = createService();
  for (const item of [
    { ...request(1).items[0], rowId: '' },
    { ...request(1).items[0], pricePaisa: 0 },
    { ...request(1).items[0], stockQuantity: 1.5 },
  ]) {
    await assert.rejects(service.bulkPreview('user-a', { ...request(1), items: [item] }));
  }
  const duplicate = request(2);
  duplicate.items[1].rowId = duplicate.items[0].rowId;
  await assert.rejects(service.bulkPreview('user-a', duplicate), /unique rowId/);
});

test('pending catalogue submissions are reusable only by their creating shop', async () => {
  const product = { id: 'pending-product', approvalStatus: 'PENDING', createdByMerchantId: 'merchant-a' };
  const prisma = {
    product: { findUnique: async () => product },
    merchantProduct: { findUnique: async () => null, create: async ({ data }) => data },
  };
  const access = { merchantContext: async (userId) => ({ merchantId: userId, isOwner: true }), requirePermission() {} };
  const service = new MerchantProductsService(prisma, access);
  const item = { rowId: '2', productId: product.id, pricePaisa: 100, stockQuantity: 1 };
  const own = await service.previewRows('merchant-a', { requestId: 'own', mode: 'ADD_MISSING', items: [item] });
  assert.equal(own[0].status, 'MATCH');
  const foreign = await service.previewRows('merchant-b', { requestId: 'foreign', mode: 'ADD_MISSING', items: [item] });
  assert.equal(foreign[0].status, 'CONFLICT');
  await assert.rejects(service.add('merchant-b', { productId: product.id, pricePaisa: 100, stockQuantity: 1 }), /not available to add/);
});

test('new product and shop listing commit together or roll back together', async () => {
  const products = [];
  let failListing = true;
  const db = {
    category: { findUnique: async () => ({ id: 'category-a', isActive: true, isRestricted: false }) },
    product: {
      findUnique: async () => null,
      create: async ({ data }) => { const product = { id: 'new-product', ...data }; products.push(product); return product; },
    },
    merchantProduct: { create: async ({ data }) => {
      if (failListing) throw Error('listing insert failed');
      return { id: 'listing', ...data };
    } },
  };
  db.$transaction = async (work) => {
    const previousCount = products.length;
    try { return await work(db); }
    catch (error) { products.splice(previousCount); throw error; }
  };
  const access = { merchantContext: async () => ({ merchantId: 'merchant-a' }), requirePermission() {} };
  const service = new MerchantProductsService(db, access);
  const input = { newProduct: { name: 'Fresh apples', categoryId: 'category-a', unit: 'kg' }, pricePaisa: 20000, stockQuantity: 5 };
  await assert.rejects(service.add('owner', input), /listing insert failed/);
  assert.equal(products.length, 0);
  failListing = false;
  const saved = await service.add('owner', input);
  assert.equal(saved.productId, 'new-product');
  assert.equal(products.length, 1);
  assert.equal(products[0].approvalStatus, 'PENDING');
  assert.equal(products[0].createdByMerchantId, 'merchant-a');
});
