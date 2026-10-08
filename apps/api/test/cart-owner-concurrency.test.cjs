require('reflect-metadata');
const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaService } = require('../src/prisma/prisma.service.ts');
const { CartService } = require('../src/cart/cart.service.ts');

const url = require('./disposable-database.cjs').disposableUrl();
const prisma = new PrismaService();
before(async () => assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'sirfbazar_remediation_test'));
after(async () => prisma.$disconnect());

async function fixture() {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+94${suffix.slice(0, 10)}` } });
  const customer = await prisma.customer.create({ data: { userId: user.id } });
  const shopUser = await prisma.user.create({ data: { role: 'MERCHANT_OWNER', status: 'ACTIVE', phoneNumber: `+95${suffix.slice(0, 10)}` } });
  const merchant = await prisma.merchant.create({ data: { userId: shopUser.id, shopName: `Test ${suffix}`, shopType: 'GROCERY', phoneNumber: `+96${suffix.slice(0, 10)}`, address: 'Test street', city: 'Lahore', latitude: 31.5, longitude: 74.3, approvalStatus: 'APPROVED', isOnline: true, isOpen: true } });
  const category = await prisma.category.create({ data: { name: `Test ${suffix}`, slug: `cart-${suffix}` } });
  const product = await prisma.product.create({ data: { name: `Test ${suffix}`, slug: `cart-item-${suffix}`, categoryId: category.id, approvalStatus: 'APPROVED' } });
  const listing = await prisma.merchantProduct.create({ data: { merchantId: merchant.id, productId: product.id, pricePaisa: 150, stockQuantity: 30 } });
  const service = new CartService(prisma, { validate: async () => ({ discountPaisa: 0, freeDelivery: false }) }, { deliveryFeePaisa: () => 0, serviceFeePaisa: () => 0, smallOrderFeePaisa: () => 0 });
  return { customer, listing, service };
}

test('concurrent initial cart creation and adds retain one active cart and both increments', async () => {
  const { customer, listing, service } = await fixture();
  const owner = { customerId: customer.id };
  await Promise.all([service.getOrCreateActiveCart(owner), service.getOrCreateActiveCart(owner)]);
  assert.equal(await prisma.cart.count({ where: { customerId: customer.id, status: 'ACTIVE' } }), 1);
  await Promise.all([service.addItem(owner, listing.id, 2), service.addItem(owner, listing.id, 3)]);
  const cart = await prisma.cart.findFirst({ where: { customerId: customer.id, status: 'ACTIVE' }, include: { items: true } });
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 5);
});
