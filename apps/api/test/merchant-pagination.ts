import assert from 'node:assert/strict';
import { MerchantOrdersService } from '../src/orders/merchant-orders.service';
import { MerchantProductsService } from '../src/merchant/merchant-products.service';

async function main() {
  const access = { merchantContext: async () => ({ merchantId: 'shop-a' }), requirePermission: () => undefined };
  let orderQuery: Record<string, unknown> = {};
  const orderPrisma = { order: {
    findMany: async (query: Record<string, unknown>) => { orderQuery = query; return [{ id: 'order-1' }]; },
    count: async () => 126,
  } };
  const orders = new MerchantOrdersService(orderPrisma as never, access as never, null as never, null as never, null as never, null as never);
  const page = await orders.list('owner', { page: '2', pageSize: '20', attention: 'true' });
  assert.ok(!Array.isArray(page));
  assert.equal(page.total, 126);
  assert.equal(page.totalPages, 7);
  assert.equal(page.page, 2);
  assert.equal(orderQuery.skip, 20);
  assert.equal(orderQuery.take, 20);
  assert.deepEqual((orderQuery.where as { status: { in: string[] } }).status.in,
    ['SENT_TO_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']);
  assert.equal((orderQuery.where as { merchantId: string }).merchantId, 'shop-a');

  const legacy = await orders.list('owner', { status: 'SENT_TO_MERCHANT' });
  assert.ok(Array.isArray(legacy));
  assert.equal(orderQuery.take, 100);

  let productQuery: Record<string, unknown> = {};
  const productPrisma = { merchantProduct: {
    findMany: async (query: Record<string, unknown>) => { productQuery = query; return []; },
    count: async () => 57,
  } };
  const products = new MerchantProductsService(productPrisma as never, access as never);
  const listings = await products.list('owner', { page: '2', pageSize: '24', q: 'milk', isAvailable: 'true', minStock: '3' });
  assert.equal(listings.total, 57);
  assert.equal(listings.totalPages, 3);
  assert.equal(productQuery.skip, 24);
  assert.equal(productQuery.take, 24);
  assert.equal((productQuery.where as { merchantId: string }).merchantId, 'shop-a');
  assert.equal((productQuery.where as { isAvailable: boolean }).isAvailable, true);
  assert.deepEqual((productQuery.where as { stockQuantity: unknown }).stockQuantity, { gte: 3 });
  await assert.rejects(products.list('owner', { minStock: '-1' }));
  console.log('Merchant pagination and listing filters passed');
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
