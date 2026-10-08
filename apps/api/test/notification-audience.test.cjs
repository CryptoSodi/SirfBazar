require('reflect-metadata');
const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaService } = require('../src/prisma/prisma.service.ts');
const { NotificationsService } = require('../src/notifications/notifications.service.ts');
const { encodeAudience, parseAudience } = require('../src/notifications/notification-audience.ts');

const url = require('./disposable-database.cjs').disposableUrl();
const prisma = new PrismaService();
before(async () => assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'sirfbazar_remediation_test'));
after(async () => prisma.$disconnect());

test('one account in customer and merchant apps sees only its current audience; legacy remains reachable', async () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+91${suffix}` } });
  await prisma.customer.create({ data: { userId: user.id } });
  const merchant = await prisma.merchant.create({ data: { userId: user.id, shopName: `Shop ${suffix}`, shopType: 'GROCERY', phoneNumber: `+92${suffix}`, address: 'Test street', city: 'Lahore', latitude: 31.5, longitude: 74.3, approvalStatus: 'APPROVED' } });
  const service = new NotificationsService(prisma, { emitToUser() {} }, { async sendToUser() {} }, { async sendToUser() {} });
  const customer = await service.notify({ userId: user.id, audience: 'CUSTOMER', scopeId: user.id, title: 'Order', body: 'Order update', type: 'ORDER_PLACED' });
  const shop = await service.notify({ userId: user.id, audience: 'MERCHANT', scopeId: merchant.id, title: 'Shop', body: 'Shop update', type: 'NEW_ORDER' });
  const legacy = await prisma.notification.create({ data: { userId: user.id, title: 'Earlier', body: 'Ambiguous account notice', type: 'SYSTEM' } });
  assert.deepEqual((await service.list({ userId: user.id, role: 'CUSTOMER' })).map((row) => row.id), [customer.id]);
  assert.deepEqual((await service.list({ userId: user.id, role: 'MERCHANT_OWNER' })).map((row) => row.id), [shop.id]);
  assert.deepEqual((await service.list({ userId: user.id, role: 'CUSTOMER' }, false, 'legacy')).map((row) => row.id), [legacy.id]);
  await service.markAllRead({ userId: user.id, role: 'CUSTOMER' });
  assert.equal((await prisma.notification.findUnique({ where: { id: customer.id } })).isRead, true);
  assert.equal((await prisma.notification.findUnique({ where: { id: shop.id } })).isRead, false);
  assert.equal((await prisma.notification.findUnique({ where: { id: legacy.id } })).isRead, false);
  await service.markRead({ userId: user.id, role: 'CUSTOMER' }, legacy.id, 'legacy');
  assert.equal((await prisma.notification.findUnique({ where: { id: legacy.id } })).isRead, true);
  assert.deepEqual(parseAudience(encodeAudience({ audience: 'MERCHANT', scopeId: merchant.id, baseType: 'NEW_ORDER' })), { audience: 'MERCHANT', scopeId: merchant.id, baseType: 'NEW_ORDER' });
  assert.equal(parseAudience('SYSTEM'), null);
});
