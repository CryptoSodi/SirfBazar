require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const r = require('../src/auth/review-access.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { JwtAuthGuard } = require('../src/common/guards/jwt-auth.guard.ts');
const { RealtimeGateway } = require('../src/realtime/realtime.gateway.ts');

function enabled() {
  process.env.PLAY_REVIEW_ENABLED = 'true';
}

test('review access is manually revoked; role and disabled config fail closed', () => {
  delete process.env.PLAY_REVIEW_ENABLED;
  assert.throws(() => r.requireReviewSession(r.REVIEW_ACCOUNTS[0].userId, 'CUSTOMER'), /disabled/);
  assert.doesNotThrow(() => r.requireReviewSession('ordinary-user', 'CUSTOMER'));
  enabled();
  for (const account of r.REVIEW_ACCOUNTS) {
    assert.doesNotThrow(() => r.requireReviewSession(account.userId, account.role));
    assert.throws(() => r.requireReviewSession(account.userId, 'SUPER_ADMIN'), /invalid/);
  }
  process.env.PLAY_REVIEW_EXPIRES_AT = 'not-a-date';
  assert.equal(r.reviewAccessActive(), true);
  process.env.PLAY_REVIEW_EXPIRES_AT = new Date(Date.now() - 1).toISOString();
  assert.equal(r.reviewAccessActive(), true);
  assert.throws(() => r.requireReviewSession(`${r.REVIEW_MEMBER_PREFIX}rider`, 'RIDER'), /not login/);
  process.env.PLAY_REVIEW_ENABLED = 'false';
  assert.equal(r.reviewAccessActive(), false);
});

test('cart boundary isolates normal customers, guests and reviewers in both directions', () => {
  for (const owner of [undefined, 'ordinary-customer']) {
    assert.throws(() => r.requireReviewCartBoundary(owner, r.REVIEW_SHOP_ID), /isolated/);
    assert.doesNotThrow(() => r.requireReviewCartBoundary(owner, 'ordinary-shop'));
  }
  assert.throws(() => r.requireReviewCartBoundary(r.REVIEW_CUSTOMER_ID, 'ordinary-shop'), /isolated/);
  assert.doesNotThrow(() => r.requireReviewCartBoundary(r.REVIEW_CUSTOMER_ID, r.REVIEW_SHOP_ID));
});

test('unknown routes, personal identity linking and payment confirmation fail closed', () => {
  for (const [controller, method] of [['AuthController','googleLink'], ['PaymentsController','confirm'], ['UnknownController','newEndpoint']]) {
    assert.throws(() => r.requireReviewRoute(r.REVIEW_ACCOUNTS[0].userId, controller, method), /not available/);
    assert.doesNotThrow(() => r.requireReviewRoute('ordinary-user', controller, method));
  }
  for (const [controller, method] of [['OrdersController','place'], ['MerchantOrdersController','assignRider'], ['RiderController','delivered'], ['MerchantController','createRider'], ['MerchantController','createStaff'], ['CartController','applyCoupon'], ['CustomersController','updateProfile'], ['OrdersController','rate'], ['SupportController','create'], ['PosController','createSale'], ['NotificationsController','saveToken']]) {
    assert.doesNotThrow(() => r.requireReviewRoute(r.REVIEW_ACCOUNTS[0].userId, controller, method));
  }
});

test('review challenge never sends WhatsApp and requires exact marked account and hash', async () => {
  enabled();
  const account = r.REVIEW_ACCOUNTS[0];
  process.env.PLAY_REVIEW_CUSTOMER_CODE_HASH = await bcrypt.hash('654321', 12);
  let sends = 0, creates = 0;
  const auth = new AuthService({ user: { findUnique: async () => ({ id: account.userId, status: 'ACTIVE' }) } }, {}, {}, {});
  auth.createOtp = async () => { creates++; return { id: 'challenge' }; };
  auth.deliverOtp = async () => { sends++; return 'submitted'; };
  assert.equal((await auth.sendOtp(account.phone)).status, 'test');
  assert.equal(sends, 0);
  assert.equal(creates, 1);
  assert.throws(() => r.reviewCodeHash(account.phone, 'MERCHANT_PASSWORD_RESET'), /cannot reset/);
  auth.prisma.user.findUnique = async () => ({ id: 'unrelated', status: 'ACTIVE' });
  await assert.rejects(auth.sendOtp(account.phone), /unavailable/);
  await auth.sendOtp('+923001234567');
  assert.equal(sends, 1);
  process.env.PLAY_REVIEW_CUSTOMER_CODE_HASH = 'plaintext';
  assert.throws(() => r.reviewCodeHash(account.phone, 'LOGIN'), /not configured/);
});

test('reserved registration is rejected before touching an existing user', async () => {
  const auth = new AuthService({}, {}, {}, {});
  await assert.rejects(auth.startMerchantRegistration({ contact: r.REVIEW_ACCOUNTS[0].phone }), /Reserved/);
  await assert.rejects(auth.resetMerchantPassword(r.REVIEW_ACCOUNTS[0].phone, '123456', 'password'), /Reserved/);
});

test('disabled review JWT is rejected and manual revocation disconnects realtime subscriptions', async () => {
  process.env.PLAY_REVIEW_ENABLED = 'false';
  const payload = { sub: r.REVIEW_ACCOUNTS[0].userId, role: 'CUSTOMER', sid: 'session' };
  const jwt = { verifyAsync: async () => payload };
  const guard = new JwtAuthGuard(jwt, { getAllAndOverride: () => false }, {});
  const req = { headers: { authorization: 'Bearer test' } };
  await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }), getClass: () => class OrdersController {}, getHandler: () => function list() {} }), /Authentication required/);
  const gateway = new RealtimeGateway(jwt, {});
  let disconnected = false;
  assert.equal(await gateway.current({ data: { userId: payload.sub, role: 'CUSTOMER' }, disconnect: () => { disconnected = true; } }), false);
  assert.equal(disconnected, true);
});

test('review POS access is not a trial and demo products cannot enter ordinary shops', () => {
  enabled();
  assert.equal(r.reviewPosEntitlement(r.REVIEW_SHOP_ID).salesEnabled, true);
  assert.equal(r.reviewPosEntitlement(r.REVIEW_SHOP_ID).endsAt, null);
  assert.equal(r.reviewPosEntitlement('ordinary-shop'), null);
  assert.throws(() => r.requireReviewProductBoundary(r.REVIEW_SHOP_ID, 'ordinary-shop'), /isolated/);
  assert.doesNotThrow(() => r.requireReviewProductBoundary(null, r.REVIEW_SHOP_ID));
  process.env.PLAY_REVIEW_ENABLED = 'false';
  assert.equal(r.reviewPosEntitlement(r.REVIEW_SHOP_ID).salesEnabled, false);
});

test('changed review memberships fail closed', () => {
  const [customer, merchant, rider] = r.REVIEW_ACCOUNTS;
  assert.equal(r.reviewMembershipValid(customer.userId, { customer: { id: 'other' } }), false);
  assert.equal(r.reviewMembershipValid(merchant.userId, { merchant: { id: 'other' } }), false);
  assert.equal(r.reviewMembershipValid(rider.userId, { rider: { id: r.REVIEW_RIDER_ID, merchantId: 'other' } }), false);
  assert.equal(r.reviewMembershipValid(rider.userId, { rider: { id: r.REVIEW_RIDER_ID, merchantId: r.REVIEW_SHOP_ID } }), true);
});

test('catalogue query separates review shop and normal discovery', () => {
  enabled();
  assert.deepEqual(r.reviewMerchantFilter(), { id: { not: r.REVIEW_SHOP_ID } });
  assert.deepEqual(r.reviewMerchantFilter('ordinary-user'), { id: { not: r.REVIEW_SHOP_ID } });
  assert.deepEqual(r.reviewMerchantFilter(r.REVIEW_ACCOUNTS[0].userId), { id: r.REVIEW_SHOP_ID });
});
