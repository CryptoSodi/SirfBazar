require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CatalogService } = require('../src/catalog/catalog.service');
const { canSellShopProduct, shopProductApprovalWhere } = require('../src/common/shop-product-visibility');

test('only the submitting shop may sell a pending product', () => {
  const own = { approvalStatus: 'PENDING', createdByMerchantId: 'shop-a' };
  assert.equal(canSellShopProduct(own, 'shop-a'), true);
  assert.equal(canSellShopProduct(own, 'shop-b'), false);
  assert.equal(canSellShopProduct({ ...own, approvalStatus: 'REJECTED' }, 'shop-a'), false);
  assert.equal(canSellShopProduct({ ...own, approvalStatus: 'DISABLED' }, 'shop-a'), false);
  assert.equal(canSellShopProduct({ ...own, approvalStatus: 'APPROVED' }, 'shop-b'), true);
  assert.deepEqual(shopProductApprovalWhere('shop-a'), { OR: [
    { approvalStatus: 'APPROVED' },
    { approvalStatus: 'PENDING', createdByMerchantId: 'shop-a' },
  ] });
});

test('shop storefront includes its pending product without promoting it into shared discovery', async () => {
  const pending = { id: 'product-a', name: 'Shop apple', approvalStatus: 'PENDING', createdByMerchantId: 'shop-a', categoryId: 'fruit' };
  const merchant = { id: 'shop-a', shopName: 'Shop A', approvalStatus: 'APPROVED', isOnline: true, isOpen: true, openingTime: '00:00', closingTime: '23:59', operatingHours: [], ratingAverage: 0 };
  const listing = { id: 'listing-a', merchantId: 'shop-a', productId: pending.id, product: pending, merchant, pricePaisa: 100, discountPricePaisa: null, stockQuantity: 2, isAvailable: true };
  let shopWhere, offerWhere;
  const db = {
    merchant: { findUnique: async () => merchant },
    product: { findUnique: async () => ({ ...pending, category: { id: 'fruit', name: 'Fruit', slug: 'fruit' } }) },
    merchantProduct: {
      findMany: async ({ where }) => {
        if (where.productId) { offerWhere = where; return [listing]; }
        shopWhere = where; return [listing];
      },
      count: async () => 1,
    },
  };
  const catalog = new CatalogService(db);
  catalog.buildProductCards = async () => [];
  const shop = await catalog.merchantProducts('shop-a', {});
  assert.equal(shop.items[0].product.name, 'Shop apple');
  assert.deepEqual(shopWhere.product.AND[0], shopProductApprovalWhere('shop-a'));
  const detail = await catalog.productDetail(pending.id, {});
  assert.equal(detail.offers[0].merchant.id, 'shop-a');
  assert.equal(offerWhere.merchantId, 'shop-a');
  let sharedWhere;
  const sharedCatalog = new CatalogService({ merchantProduct: { findMany: async ({ where }) => { sharedWhere = where; return []; } } });
  assert.deepEqual((await sharedCatalog.search({})).items, []);
  assert.equal(sharedWhere.product.approvalStatus, 'APPROVED');
});
