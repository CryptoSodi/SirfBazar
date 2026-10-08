require('reflect-metadata');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaService } = require('../src/prisma/prisma.service.ts');
const { AccessService } = require('../src/common/access.service.ts');
const { PricingService } = require('../src/common/pricing.service.ts');
const { CouponsService } = require('../src/coupons/coupons.service.ts');
const { OrderStatusService } = require('../src/orders/order-status.service.ts');
const { OrdersService } = require('../src/orders/orders.service.ts');
const { RefundsService } = require('../src/refunds/refunds.service.ts');
const { SettlementsService } = require('../src/settlements/settlements.service.ts');
const { SupportService } = require('../src/support/support.service.ts');
const { RiderService } = require('../src/rider/rider.service.ts');
const { OrderOtpInterceptor } = require('../src/common/order-otp.interceptor.ts');
const { MerchantProductsService } = require('../src/merchant/merchant-products.service.ts');
const { MerchantOrdersService } = require('../src/orders/merchant-orders.service.ts');
const { of, firstValueFrom } = require('rxjs');
const { OrderStatus, PaymentStatus } = require('../src/common/constants.ts');

const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/remediation|test/i.test(url.pathname)) {
  throw new Error('test:remediation requires a local disposable test database');
}
const prisma = new PrismaService();
const realtime = { emitToOrder() {}, emitToMerchant() {}, emitToRider() {}, emitToUser() {}, emitToAdmins() {} };
const notifications = { async notify() { return null; }, async notifyMany() {} };
const access = new AccessService(prisma);
const coupons = new CouponsService(prisma);
const refunds = new RefundsService(prisma, notifications);
const status = new OrderStatusService(prisma, realtime);
const orders = new OrdersService(prisma, null, coupons, refunds, notifications, realtime, access, new PricingService(), status);
const settlements = new SettlementsService(prisma, notifications);
after(async () => prisma.$disconnect());

async function merchant(suffix) {
  const user = await prisma.user.create({ data: { role: 'MERCHANT_OWNER', status: 'ACTIVE', phoneNumber: `+92${suffix.slice(0, 10)}` } });
  return prisma.merchant.create({ data: {
    userId: user.id, shopName: `Test ${suffix}`, shopType: 'GROCERY', phoneNumber: `+92${suffix.slice(0, 10)}`,
    address: 'Disposable test street', city: 'Lahore', latitude: 31.5, longitude: 74.3,
    serviceRadiusKm: 50, approvalStatus: 'APPROVED', isOpen: true, isOnline: true,
  } });
}

async function customer(suffix) {
  const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+93${suffix.slice(0, 10)}` } });
  const profile = await prisma.customer.create({ data: { userId: user.id } });
  const address = await prisma.customerAddress.create({ data: { customerId: profile.id, fullAddress: 'Disposable test address', city: 'Lahore', latitude: 31.5, longitude: 74.3 } });
  return { user, profile, address };
}

async function listing(shop, suffix, stock = 1) {
  const category = await prisma.category.create({ data: { name: `Test ${suffix}`, slug: `test-${suffix}` } });
  const product = await prisma.product.create({ data: { name: `Test product ${suffix}`, slug: `product-${suffix}`, categoryId: category.id, approvalStatus: 'APPROVED' } });
  return prisma.merchantProduct.create({ data: { merchantId: shop.id, productId: product.id, pricePaisa: 10000, stockQuantity: stock } });
}

async function cartFor(buyer, item) {
  const cart = await prisma.cart.create({ data: { customerId: buyer.profile.id } });
  await prisma.cartItem.create({ data: { cartId: cart.id, merchantId: item.merchantId, productId: item.productId, merchantProductId: item.id, quantity: 1, unitPricePaisa: item.pricePaisa } });
  return cart;
}

const request = (buyer, cart, quote) => ({ requestId: randomUUID(), cartId: cart.id, deliveryAddressId: buyer.address.id, paymentMethod: 'COD', approvedQuote: quote.approvedQuote });

test('approved checkout binds the quote, recovers exact ID, reserves last unit once and restores once', async () => {
  await prisma.$connect();
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const item = await listing(shop, suffix, 1);
  const a = await customer(`1${suffix}`);
  const b = await customer(`2${suffix}`);
  const ca = await cartFor(a, item);
  const cb = await cartFor(b, item);
  const qa = await orders.quoteOrder(a.user.id, { cartId: ca.id, deliveryAddressId: a.address.id, paymentMethod: 'COD' });
  const qb = await orders.quoteOrder(b.user.id, { cartId: cb.id, deliveryAddressId: b.address.id, paymentMethod: 'COD' });
  assert.ok(qa.quote.totalAmountPaisa > 0);
  await assert.rejects(orders.placeOrder(a.user.id, { ...request(a, ca, qa), approvedQuote: undefined }), (error) => error.getResponse?.().code === 'QUOTE_REQUIRED');
  await assert.rejects(orders.placeOrder(a.user.id, { ...request(a, ca, qa), approvedQuote: qb.approvedQuote }), (error) => error.getResponse?.().code === 'QUOTE_CHANGED');
  const ra = request(a, ca, qa);
  const rb = request(b, cb, qb);
  const results = await Promise.allSettled([orders.placeOrder(a.user.id, ra), orders.placeOrder(b.user.id, rb)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const winner = results[0].status === 'fulfilled' ? { buyer: a, input: ra, order: results[0].value } : { buyer: b, input: rb, order: results[1].value };
  const replay = await orders.placeOrder(winner.buyer.user.id, winner.input);
  assert.equal(replay.id, winner.order.id);
  assert.equal((await prisma.merchantProduct.findUnique({ where: { id: item.id } })).stockQuantity, 0);
  const cancels = await Promise.allSettled([orders.cancelByCustomer(winner.buyer.user.id, winner.order.id), orders.cancelByCustomer(winner.buyer.user.id, winner.order.id)]);
  assert.equal(cancels.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await prisma.merchantProduct.findUnique({ where: { id: item.id } })).stockQuantity, 1);
});

test('checkout rejects a torn outer listing snapshot even when transaction quote still matches', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const item = await listing(shop, suffix, 1);
  const buyer = await customer(`0${suffix}`);
  const cart = await cartFor(buyer, item);
  const quote = await orders.quoteOrder(buyer.user.id, { cartId: cart.id, deliveryAddressId: buyer.address.id, paymentMethod: 'COD' });
  const original = prisma.merchantProduct.findMany;
  let reads = 0;
  prisma.merchantProduct.findMany = async function (...args) {
    const rows = await original.apply(this, args);
    reads++;
    // First placeOrder read verifies the quote; the second builds its write
    // projection. Simulate a stale/torn outer read without altering the DB.
    return reads === 2 ? rows.map((row) => ({ ...row, pricePaisa: row.pricePaisa + 1000 })) : rows;
  };
  try {
    await assert.rejects(orders.placeOrder(buyer.user.id, request(buyer, cart, quote)), (error) => error.getResponse?.().code === 'QUOTE_CHANGED');
  } finally { prisma.merchantProduct.findMany = original; }
  assert.equal((await prisma.merchantProduct.findUnique({ where: { id: item.id } })).stockQuantity, 1);
  assert.equal((await prisma.order.count({ where: { customerId: buyer.profile.id } })), 0);
});

test('paid cancellation commits refund despite notification failure and rolls back if refund fails', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const item = await listing(shop, suffix, 2);
  const buyer = await customer(`6${suffix}`);
  const makeOrder = async () => {
    const cart = await cartFor(buyer, item);
    const quote = await orders.quoteOrder(buyer.user.id, { cartId: cart.id, deliveryAddressId: buyer.address.id, paymentMethod: 'COD' });
    const order = await orders.placeOrder(buyer.user.id, request(buyer, cart, quote));
    await prisma.payment.updateMany({ where: { orderId: order.id }, data: { status: PaymentStatus.PAID } });
    return order;
  };
  const first = await makeOrder();
  const priorNotify = notifications.notifyMany;
  notifications.notifyMany = async () => { throw new Error('simulated delivery outage'); };
  try { await orders.cancelByCustomer(buyer.user.id, first.id); }
  finally { notifications.notifyMany = priorNotify; }
  const firstRefund = await prisma.refund.findFirst({ where: { orderId: first.id, status: 'COMPLETED' } });
  assert.ok(firstRefund);
  assert.equal((await prisma.customer.findUnique({ where: { id: buyer.profile.id } })).walletBalancePaisa, first.totalAmountPaisa);
  const second = await makeOrder();
  const priorCreate = refunds.createInTransaction;
  refunds.createInTransaction = async () => { throw new Error('simulated refund failure'); };
  try { await assert.rejects(orders.cancelByCustomer(buyer.user.id, second.id), /simulated refund failure/); }
  finally { refunds.createInTransaction = priorCreate; }
  assert.equal((await prisma.order.findUnique({ where: { id: second.id } })).status, OrderStatus.SENT_TO_MERCHANT);
  assert.equal((await prisma.merchantProduct.findUnique({ where: { id: item.id } })).stockQuantity, 1);
});

test('standalone refunds credit once and parent approvals cap out-of-order requests', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const buyer = await customer(`3${suffix}`);
  const order = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, merchantId: shop.id, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, paymentMethod: 'CARD', totalAmountPaisa: 10000, merchantEarningPaisa: 9000 } });
  await prisma.payment.create({ data: { orderId: order.id, customerId: buyer.profile.id, amountPaisa: 10000, paymentMethod: 'CARD', status: PaymentStatus.PAID } });
  const attempts = await Promise.allSettled([refunds.create({ orderId: order.id, customerId: buyer.profile.id, amountPaisa: 10000, reason: 'test', autoApprove: true }), refunds.create({ orderId: order.id, customerId: buyer.profile.id, amountPaisa: 10000, reason: 'test', autoApprove: true })]);
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await prisma.customer.findUnique({ where: { id: buyer.profile.id } })).walletBalancePaisa, 10000);
  const secondShop = await merchant(`4${suffix}`);
  const parent = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, isParent: true, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, paymentMethod: 'CARD', totalAmountPaisa: 10000 } });
  await prisma.order.createMany({ data: [shop, secondShop].map((merchant) => ({ orderNumber: `T-${randomUUID()}`, parentOrderId: parent.id, customerId: buyer.profile.id, merchantId: merchant.id, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID, paymentMethod: 'CARD', totalAmountPaisa: 5000, merchantEarningPaisa: 4500 })) });
  await prisma.payment.create({ data: { orderId: parent.id, customerId: buyer.profile.id, amountPaisa: 10000, paymentMethod: 'CARD', status: PaymentStatus.PAID } });
  const older = await refunds.create({ orderId: parent.id, customerId: buyer.profile.id, amountPaisa: 6000, reason: 'first request' });
  const newer = await refunds.create({ orderId: parent.id, customerId: buyer.profile.id, amountPaisa: 5000, reason: 'second request' });
  await refunds.approve(newer.id, buyer.user.id);
  await assert.rejects(refunds.approve(older.id, buyer.user.id));
  await refunds.process(newer.id);
  const children = await prisma.order.findMany({ where: { parentOrderId: parent.id }, orderBy: { id: 'asc' } });
  assert.equal(children[0].paymentStatus, PaymentStatus.REFUNDED);
  assert.equal(children[1].paymentStatus, PaymentStatus.PAID);
});

test('mixed COD parent refunds and settlement deductions follow collected child regardless of ID order', async () => {
  for (const deliveredFirst of [true, false]) {
    const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
    const deliveredShop = await merchant(suffix);
    const cancelledShop = await merchant(`4${suffix}`);
    const buyer = await customer(`7${suffix}`);
    const ids = [randomUUID(), randomUUID()].sort();
    const deliveredId = ids[deliveredFirst ? 0 : 1];
    const cancelledId = ids[deliveredFirst ? 1 : 0];
    const parent = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, isParent: true, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.CASH_COLLECTED, paymentMethod: 'COD', totalAmountPaisa: 22000 } });
    await prisma.order.createMany({ data: [
      { id: deliveredId, orderNumber: `T-${randomUUID()}`, parentOrderId: parent.id, customerId: buyer.profile.id, merchantId: deliveredShop.id, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.CASH_COLLECTED, paymentMethod: 'COD', totalAmountPaisa: 10000, merchantEarningPaisa: 9000, deliveredAt: new Date() },
      { id: cancelledId, orderNumber: `T-${randomUUID()}`, parentOrderId: parent.id, customerId: buyer.profile.id, merchantId: cancelledShop.id, status: OrderStatus.CANCELLED_BY_CUSTOMER, paymentStatus: PaymentStatus.CASH_PENDING, paymentMethod: 'COD', totalAmountPaisa: 10000 },
    ] });
    await prisma.payment.create({ data: { orderId: parent.id, customerId: buyer.profile.id, amountPaisa: 12000, paymentMethod: 'COD', status: PaymentStatus.CASH_COLLECTED } });
    await assert.rejects(refunds.create({ orderId: cancelledId, customerId: buyer.profile.id, amountPaisa: 1, reason: 'uncollected child', autoApprove: true }), /Refund exceeds this shop order/);
    const refund = await refunds.create({ orderId: parent.id, customerId: buyer.profile.id, amountPaisa: 1000, reason: 'delivered child adjustment', autoApprove: true });
    const audit = await prisma.auditLog.findUnique({ where: { id: `refund-allocation:${refund.id}` } });
    assert.deepEqual(JSON.parse(audit.newValue), [{ orderId: deliveredId, amountPaisa: 1000 }]);
    assert.equal((await prisma.order.findUnique({ where: { id: cancelledId } })).paymentStatus, PaymentStatus.CASH_PENDING);
    const generated = await settlements.generate(buyer.user.id, { merchantId: deliveredShop.id, startDate: new Date(Date.now() - 3600_000).toISOString(), endDate: new Date(Date.now() + 3600_000).toISOString() });
    assert.equal(generated.length, 1);
    assert.equal(generated[0].amountPaisa, 8000);
    const cancelledSettlement = await settlements.generate(buyer.user.id, { merchantId: cancelledShop.id, startDate: new Date(Date.now() - 3600_000).toISOString(), endDate: new Date(Date.now() + 3600_000).toISOString() });
    assert.equal(cancelledSettlement.length, 0);
  }
});

test('settlement generation claims collected delivered order once and hold/pay cannot both win', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const buyer = await customer(`5${suffix}`);
  const order = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, merchantId: shop.id, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.CASH_COLLECTED, paymentMethod: 'COD', channel: 'ONLINE', totalAmountPaisa: 10000, merchantEarningPaisa: 9000, deliveredAt: new Date() } });
  await prisma.payment.create({ data: { orderId: order.id, customerId: buyer.profile.id, amountPaisa: 10000, paymentMethod: 'COD', status: PaymentStatus.CASH_COLLECTED } });
  const input = { merchantId: shop.id, startDate: new Date(Date.now() - 3600_000).toISOString(), endDate: new Date(Date.now() + 3600_000).toISOString() };
  const generated = await Promise.allSettled([settlements.generate(buyer.user.id, input), settlements.generate(buyer.user.id, input)]);
  const created = generated.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  assert.equal(created.length, 1);
  assert.equal(created[0].amountPaisa, 9000);
  const result = await Promise.allSettled([settlements.hold(buyer.user.id, created[0].id, 'test hold'), settlements.markPaid(buyer.user.id, created[0].id, 'TEST-REF')]);
  assert.equal(result.filter((entry) => entry.status === 'fulfilled').length, 1);
});

test('production rejects master delivery OTP and mixed COD children collect only payable amount', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const buyer = await customer(`9${suffix}`);
  const riderUser = await prisma.user.create({ data: { role: 'RIDER', status: 'ACTIVE', phoneNumber: `+97${suffix.slice(0, 8)}` } });
  const rider = await prisma.rider.create({ data: { merchantId: shop.id, userId: riderUser.id, fullName: 'COD Rider', phoneNumber: `+98${suffix.slice(0, 8)}`, isActive: true, approvalStatus: 'APPROVED' } });
  const parent = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, isParent: true, status: OrderStatus.SENT_TO_MERCHANT, paymentStatus: PaymentStatus.CASH_PENDING, paymentMethod: 'COD', totalAmountPaisa: 22000 } });
  const delivered = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, parentOrderId: parent.id, customerId: buyer.profile.id, merchantId: shop.id, riderId: rider.id, status: OrderStatus.ON_THE_WAY, paymentStatus: PaymentStatus.CASH_PENDING, paymentMethod: 'COD', totalAmountPaisa: 10000, merchantEarningPaisa: 9000, deliveryOtp: '3141' } });
  await prisma.rider.update({ where: { id: rider.id }, data: { currentOrderId: delivered.id, currentStatus: 'DELIVERING' } });
  const cancelled = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, parentOrderId: parent.id, customerId: buyer.profile.id, merchantId: shop.id, status: OrderStatus.SENT_TO_MERCHANT, paymentStatus: PaymentStatus.CASH_PENDING, paymentMethod: 'COD', totalAmountPaisa: 10000 } });
  await prisma.payment.create({ data: { orderId: parent.id, customerId: buyer.profile.id, amountPaisa: 22000, paymentMethod: 'COD', status: PaymentStatus.CASH_PENDING } });
  await status.apply(cancelled.id, OrderStatus.CANCELLED_BY_CUSTOMER, { userId: buyer.user.id, role: 'CUSTOMER' });
  const service = new RiderService(prisma, access, notifications, realtime, status, null);
  const previousEnvironment = process.env.NODE_ENV;
  const previousProvider = process.env.OTP_PROVIDER;
  try {
    process.env.NODE_ENV = 'production';
    process.env.OTP_PROVIDER = 'mock';
    await assert.rejects(service.delivered(riderUser.id, delivered.id, { otp: '123456' }), /Incorrect delivery code/);
    assert.equal((await prisma.order.findUnique({ where: { id: delivered.id } })).status, OrderStatus.ON_THE_WAY);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
    if (previousProvider === undefined) delete process.env.OTP_PROVIDER; else process.env.OTP_PROVIDER = previousProvider;
  }
  await service.delivered(riderUser.id, delivered.id, { otp: '3141' });
  const payment = await prisma.payment.findFirst({ where: { orderId: parent.id } });
  assert.equal(payment.status, PaymentStatus.CASH_COLLECTED);
  assert.equal(payment.amountPaisa, 12000, 'cancelled child is not collected; parent-only fees remain due');
  assert.equal((await prisma.order.findUnique({ where: { id: parent.id } })).paymentStatus, PaymentStatus.CASH_COLLECTED);
  assert.equal((await prisma.order.findUnique({ where: { id: delivered.id } })).paymentStatus, PaymentStatus.CASH_COLLECTED);
});

test('single-shop COD collection uses final revised total after decrease, increase or item removal', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const buyer = await customer(`1${suffix}`);
  const riderUser = await prisma.user.create({ data: { role: 'RIDER', status: 'ACTIVE', phoneNumber: `+99${suffix.slice(0, 8)}` } });
  const rider = await prisma.rider.create({ data: { merchantId: shop.id, userId: riderUser.id, fullName: 'Revision Rider', phoneNumber: `+90${suffix.slice(0, 8)}`, isActive: true, approvalStatus: 'APPROVED' } });
  const service = new RiderService(prisma, access, notifications, realtime, status, null);
  for (const [reason, revisedTotal] of [['price decrease', 6000], ['price increase', 13000], ['item removed', 4000]]) {
    const order = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, merchantId: shop.id, riderId: rider.id, status: OrderStatus.ON_THE_WAY, paymentStatus: PaymentStatus.CASH_PENDING, paymentMethod: 'COD', totalAmountPaisa: 10000, deliveryOtp: '3141' } });
    await prisma.payment.create({ data: { orderId: order.id, customerId: buyer.profile.id, amountPaisa: 10000, paymentMethod: 'COD', status: PaymentStatus.CASH_PENDING } });
    await prisma.order.update({ where: { id: order.id }, data: { totalAmountPaisa: revisedTotal } });
    await prisma.rider.update({ where: { id: rider.id }, data: { currentOrderId: order.id, currentStatus: 'DELIVERING' } });
    await service.delivered(riderUser.id, order.id, { otp: '3141' });
    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    assert.equal(payment.status, PaymentStatus.CASH_COLLECTED, reason);
    assert.equal(payment.amountPaisa, revisedTotal, reason);
  }
});

test('postcommit notification failure cannot make merchant acceptance appear retryable', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const buyer = await customer(`2${suffix}`);
  const order = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, merchantId: shop.id, status: OrderStatus.SENT_TO_MERCHANT } });
  const service = new MerchantOrdersService(prisma, access, notifications, realtime, orders, status);
  const original = notifications.notify;
  notifications.notify = async () => { throw new Error('simulated notification outage'); };
  try {
    const accepted = await service.accept(shop.userId, order.id);
    assert.equal(accepted.status, OrderStatus.MERCHANT_ACCEPTED);
  } finally { notifications.notify = original; }
  assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, OrderStatus.MERCHANT_ACCEPTED);
});

test('linked support orders, rider location and nested OTP projection respect tenancy', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const ownedShop = await merchant(suffix);
  const foreignShop = await merchant(`7${suffix}`);
  const buyer = await customer(`8${suffix}`);
  const order = await prisma.order.create({ data: { orderNumber: `T-${randomUUID()}`, customerId: buyer.profile.id, merchantId: ownedShop.id, status: OrderStatus.RIDER_ASSIGNED, deliveryOtp: '3141' } });
  const support = new SupportService(prisma, access, notifications, realtime);
  await assert.rejects(support.create(foreignShop.userId, 'MERCHANT_OWNER', { orderId: order.id, issueCategory: 'OTHER', title: 'Cross shop', description: 'must fail' }));
  const ownTicket = await support.create(ownedShop.userId, 'MERCHANT_OWNER', { orderId: order.id, issueCategory: 'OTHER', title: 'Own shop', description: 'allowed' });
  assert.equal(ownTicket.orderId, order.id);
  const riderUser = await prisma.user.create({ data: { role: 'RIDER', status: 'ACTIVE', phoneNumber: `+95${suffix.slice(0, 8)}` } });
  const rider = await prisma.rider.create({ data: { merchantId: ownedShop.id, userId: riderUser.id, fullName: 'Test Rider', phoneNumber: `+96${suffix.slice(0, 8)}`, isActive: true, approvalStatus: 'APPROVED' } });
  const riderService = new RiderService(prisma, access, notifications, realtime, status, null);
  await assert.rejects(riderService.updateLocation(riderUser.id, { orderId: order.id, latitude: 31.5, longitude: 74.3 }));
  await prisma.order.update({ where: { id: order.id }, data: { riderId: rider.id } });
  await riderService.updateLocation(riderUser.id, { orderId: order.id, latitude: 31.5, longitude: 74.3 });
  await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.DELIVERED } });
  await assert.rejects(riderService.updateLocation(riderUser.id, { orderId: order.id, latitude: 31.6, longitude: 74.4 }));
  assert.equal((await prisma.rider.findUnique({ where: { id: rider.id } })).latitude, 31.5);
  const interceptor = new OrderOtpInterceptor();
  const riderContext = { switchToHttp: () => ({ getRequest: () => ({ user: { role: 'RIDER' }, path: '/api/rider/orders' }) }) };
  const nested = { children: [{ status: OrderStatus.PICKED_UP, deliveryOtp: '3141' }] };
  const hidden = await firstValueFrom(interceptor.intercept(riderContext, { handle: () => of(nested) }));
  assert.equal(hidden.children[0].deliveryOtp, null);
  const customerContext = { switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CUSTOMER' }, path: '/api/orders/owned' }) }) };
  const visible = await firstValueFrom(interceptor.intercept(customerContext, { handle: () => of(nested) }));
  assert.equal(visible.children[0].deliveryOtp, '3141');
});

test('bulk rows are idempotent and stale update preview cannot overwrite a sale', async () => {
  const suffix = String(Date.now()).slice(-8) + Math.floor(Math.random() * 100);
  const shop = await merchant(suffix);
  const category = await prisma.category.create({ data: { name: `Bulk ${suffix}`, slug: `bulk-${suffix}` } });
  const product = await prisma.product.create({ data: { name: `Bulk item ${suffix}`, slug: `bulk-product-${suffix}`, categoryId: category.id, approvalStatus: 'APPROVED' } });
  const bulk = new MerchantProductsService(prisma, access);
  const dto = { requestId: randomUUID(), mode: 'ADD_MISSING', items: [{ rowId: '001', productId: product.id, pricePaisa: 12000, stockQuantity: 4, merchantSku: '00001234' }] };
  const first = await bulk.bulkUpload(shop.userId, dto);
  assert.equal(first.created, 1);
  const replay = await bulk.bulkUpload(shop.userId, dto);
  assert.equal(replay.created, 1);
  assert.equal(replay.rows[0].merchantProductId, first.rows[0].merchantProductId);
  const signedInput = { ...dto, requestId: randomUUID() };
  const signedPreview = await bulk.bulkPreview(shop.userId, signedInput);
  const signedReplay = await bulk.bulkUpload(shop.userId, { ...signedInput, previewToken: signedPreview.previewToken });
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 11 * 60_000;
    const afterExpiry = await bulk.bulkUpload(shop.userId, { ...signedInput, previewToken: signedPreview.previewToken });
    assert.deepEqual(afterExpiry.rows, signedReplay.rows);
    await assert.rejects(bulk.bulkUpload(shop.userId, { ...signedInput, previewToken: signedPreview.previewToken, items: [{ ...signedInput.items[0], stockQuantity: 99 }] }), /Import preview expired or changed/);
  } finally { Date.now = originalNow; }
  const changed = await bulk.bulkUpload(shop.userId, { ...dto, items: [{ ...dto.items[0], pricePaisa: 13000 }] });
  assert.equal(changed.failed.length, 1);
  const listing = await prisma.merchantProduct.findUnique({ where: { id: first.rows[0].merchantProductId } });
  assert.equal(listing.pricePaisa, 12000);
  assert.equal(listing.merchantSku, '00001234');
  const updateDto = { requestId: randomUUID(), mode: 'UPDATE_EXISTING', items: [{ rowId: 'update', productId: product.id, pricePaisa: 12500, stockQuantity: 8 }] };
  const preview = await bulk.bulkPreview(shop.userId, updateDto);
  assert.equal(preview.rows[0].status, 'MATCH');
  await prisma.merchantProduct.update({ where: { id: listing.id }, data: { stockQuantity: { decrement: 1 } } });
  const stale = await bulk.bulkUpload(shop.userId, { ...updateDto, previewToken: preview.previewToken });
  assert.equal(stale.failed.length, 1);
  assert.equal((await prisma.merchantProduct.findUnique({ where: { id: listing.id } })).stockQuantity, 3);
  const corrected = { ...updateDto, requestId: randomUUID() };
  const fresh = await bulk.bulkPreview(shop.userId, corrected);
  const updated = await bulk.bulkUpload(shop.userId, { ...corrected, previewToken: fresh.previewToken });
  assert.equal(updated.updated, 1);
  assert.equal((await prisma.merchantProduct.findUnique({ where: { id: listing.id } })).stockQuantity, 8);
  await prisma.merchantProduct.update({ where: { id: listing.id }, data: { pricePaisa: 1000, discountPricePaisa: 600 } });
  const discountDto = { requestId: randomUUID(), mode: 'UPDATE_EXISTING', items: [{ rowId: 'discount', productId: product.id, pricePaisa: 500, stockQuantity: 8 }] };
  const discountPreview = await bulk.bulkPreview(shop.userId, discountDto);
  assert.equal(discountPreview.rows[0].old.effectiveSalePricePaisa, 600);
  await prisma.merchantProduct.update({ where: { id: listing.id }, data: { discountPricePaisa: 550 } });
  const staleDiscount = await bulk.bulkUpload(shop.userId, { ...discountDto, previewToken: discountPreview.previewToken });
  assert.equal(staleDiscount.failed.length, 1, 'concurrent sale-price change invalidates preview');
  const freshDiscountDto = { ...discountDto, requestId: randomUUID() };
  const freshDiscount = await bulk.bulkPreview(shop.userId, freshDiscountDto);
  const appliedDiscount = await bulk.bulkUpload(shop.userId, { ...freshDiscountDto, previewToken: freshDiscount.previewToken });
  assert.equal(appliedDiscount.updated, 1);
  const effective = await prisma.merchantProduct.findUnique({ where: { id: listing.id } });
  assert.equal(effective.pricePaisa, 500);
  assert.equal(effective.discountPricePaisa, null);
  const newDto = { requestId: randomUUID(), mode: 'ADD_MISSING', items: [{ rowId: 'new', name: `Imported ${suffix}`, categoryId: category.id, unit: 'piece', pricePaisa: 9000, stockQuantity: 2 }] };
  const newPreview = await bulk.bulkPreview(shop.userId, newDto);
  assert.equal(newPreview.rows[0].status, 'NEW');
  const newResult = await bulk.bulkUpload(shop.userId, { ...newDto, previewToken: newPreview.previewToken });
  assert.equal(newResult.created, 1);
  const imported = await prisma.merchantProduct.findUnique({ where: { id: newResult.rows[0].merchantProductId }, include: { product: true } });
  assert.equal(imported.product.approvalStatus, 'PENDING');
  const partialDto = { requestId: randomUUID(), mode: 'ADD_MISSING', items: [
    { rowId: 'already-listed', productId: product.id, pricePaisa: 1000, stockQuantity: 2 },
    { rowId: 'not-applied', name: `Expired partial ${suffix}`, categoryId: category.id, unit: 'piece', pricePaisa: 2000, stockQuantity: 1 },
  ] };
  const partialPreview = await bulk.bulkPreview(shop.userId, partialDto);
  await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
  const partial = await bulk.bulkUpload(shop.userId, { ...partialDto, previewToken: partialPreview.previewToken });
  assert.equal(partial.skipped, 1);
  assert.equal(partial.failed.length, 1);
  await prisma.category.update({ where: { id: category.id }, data: { isActive: true } });
  const beforeExpiry = Date.now;
  try {
    Date.now = () => beforeExpiry() + 11 * 60_000;
    const expiredReplay = await bulk.bulkUpload(shop.userId, { ...partialDto, previewToken: partialPreview.previewToken });
    assert.equal(expiredReplay.skipped, 1);
    assert.equal(expiredReplay.failed.length, 1);
    assert.equal(expiredReplay.rows[0].status, 'SKIPPED');
    assert.match(expiredReplay.rows[1].error, /preview expired/i);
    await assert.rejects(bulk.bulkUpload(shop.userId, { ...partialDto, previewToken: partialPreview.previewToken, items: [{ ...partialDto.items[0], stockQuantity: 99 }, partialDto.items[1]] }), /Import preview expired or changed/);
  } finally { Date.now = beforeExpiry; }
  assert.equal(await prisma.product.count({ where: { name: `Expired partial ${suffix}` } }), 0, 'expired unaudited row never writes after category becomes active');
});
