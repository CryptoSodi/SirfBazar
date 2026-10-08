// No database or HTTP server: exercise the real service against an atomic fake.
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { CartService } = require('../src/cart/cart.service');
function fixture() {
  let state = { status: 'ACTIVE', quantity: 3, couponCode: null };
  let fail = false, queue = Promise.resolve();
  const guest = () => ({ id: 'guest-cart', couponCode: 'WELCOME', items: [
    { merchantId: 'shop', productId: 'milk', merchantProductId: 'mp', quantity: 2, unitPricePaisa: 29500 },
  ] });
  const prisma = {
    guestSession: { findUnique: async ({ where }) => where.sessionToken === 'valid' ? { id: 'guest', expiresAt: new Date(Date.now() + 60000) } : null },
    customer: { findUnique: async ({ where }) => where.userId === 'customer-user' ? { id: 'customer' } : null },
    cart: { findFirst: async () => state.status === 'ACTIVE' ? guest() : null },
    $transaction: (operation) => {
      const result = queue.then(async () => {
        const before = { ...state };
        try { return await operation({
          $queryRaw: async () => [{ id: 'locked-owner' }],
          cart: {
            updateMany: async ({ where, data }) => {
              assert.equal(where.id, 'guest-cart'); assert.equal(where.status, 'ACTIVE');
              if (state.status !== 'ACTIVE') return { count: 0 };
              state.status = data.status; return { count: 1 };
            },
            findFirst: async ({ where }) => where.guestSessionId ? (state.status === 'ACTIVE' ? guest() : null) : { id: 'customer-cart' },
            findUniqueOrThrow: async () => ({ id: 'customer-cart', couponCode: state.couponCode }),
            update: async ({ data }) => { state.couponCode = data.couponCode; },
          },
          merchantProduct: { findUnique: async () => ({ id: 'mp', stockQuantity: 20, isAvailable: true, merchant: { approvalStatus: 'APPROVED' }, product: { approvalStatus: 'APPROVED' } }) },
          cartItem: { findUnique: async () => ({ quantity: state.quantity }), upsert: async ({ where, update }) => {
            assert.equal(where.cartId_merchantProductId.cartId, 'customer-cart');
            state.quantity += update.quantity.increment;
            if (fail) throw Error('Injected copy failure');
          } },
        }); } catch (cause) { state = before; throw cause; }
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
  const service = new CartService(prisma, {}, {});
  service.viewInTransaction = async () => ({ ...state });
  return { service, state: () => state, fail: (value) => fail = value };
}
test('concurrent same-guest merges copy quantities exactly once', async () => {
  const f = fixture();
  await Promise.all([f.service.mergeGuestCart('valid', 'customer-user'), f.service.mergeGuestCart('valid', 'customer-user')]);
  assert.deepEqual(f.state(), { status: 'MERGED', quantity: 5, couponCode: 'WELCOME' });
  await f.service.mergeGuestCart('valid', 'customer-user');
  assert.equal(f.state().quantity, 5);
});
test('failed copy rolls back guest claim and permits a safe retry', async () => {
  const f = fixture(); f.fail(true);
  await assert.rejects(f.service.mergeGuestCart('valid', 'customer-user'), /Injected copy failure/);
  assert.deepEqual(f.state(), { status: 'ACTIVE', quantity: 3, couponCode: null });
  f.fail(false); await f.service.mergeGuestCart('valid', 'customer-user');
  assert.equal(f.state().quantity, 5);
});
test('invalid guest or missing customer cannot merge another basket', async () => {
  const f = fixture();
  await assert.rejects(f.service.mergeGuestCart('invalid', 'customer-user'));
  await assert.rejects(f.service.mergeGuestCart('valid', 'not-a-customer'));
  assert.equal(f.state().quantity, 3);
});
