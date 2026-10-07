require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { OrdersService } = require('../src/orders/orders.service');
function fixture(multi = false) {
  let state = { active: true, stock: 20, payments: 0, orders: [] };
  let queue = Promise.resolve(), fail = false;
  const item = { merchantProductId: 'mp', quantity: 2 };
  const mp = { id: 'mp', productId: 'milk', merchantId: 'shop', pricePaisa: 29500, stockQuantity: 20, isAvailable: true,
    product: { name: 'Milk', unit: 'litre' }, merchant: { id: 'shop', shopName: 'Shop', approvalStatus: 'APPROVED', isOpen: true, isOnline: true, latitude: 31.52, longitude: 74.35, serviceRadiusKm: 20, minimumOrderValuePaisa: 0, averagePreparationMinutes: 10 } };
  const prisma = {
    customer: { findUnique: async ({ where }) => ({ id: where.userId, user: { fullName: 'Test' } }) },
    cart: { findFirst: async () => state.active ? { id: 'cart', items: multi ? [item, { ...item, merchantProductId: 'mp2' }] : [item] } : null },
    customerAddress: { findFirst: async ({ where }) => ({ id: where.id, latitude: 31.52, longitude: 74.35, city: 'Lahore' }) },
    merchantProduct: { findMany: async () => multi ? [mp, { ...mp, id: 'mp2', merchantId: 'shop2', merchant: { ...mp.merchant, id: 'shop2' } }] : [mp] },
    order: { findUnique: async ({ where }) => state.orders.find((entry) => entry.id === where.id) ?? null },
    $transaction: (task) => {
      const result = queue.then(async () => {
        const before = structuredClone(state);
        try { return await task({
          cart: { updateMany: async ({ where, data }) => {
            assert.equal(where.id, 'cart'); assert.equal(where.status, 'ACTIVE'); assert.equal(where.customerId, 'customer');
            assert.equal(data.status, 'CHECKED_OUT');
            if (!state.active) return { count: 0 };
            state.active = false; return { count: 1 };
          } },
          merchantProduct: { updateMany: async ({ data }) => { state.stock -= data.stockQuantity.decrement; return { count: 1 }; } },
          order: { create: async ({ data }) => {
            if (fail) throw Error('Injected write failure');
            const record = { ...data, id: data.id || 'child-' + state.orders.length };
            if (state.orders.some((entry) => entry.id === record.id)) throw Error('Unique ID collision');
            state.orders.push(record); return record;
          } },
          orderItem: { createMany: async () => {} }, orderTimelineEntry: { createMany: async () => {} },
          payment: { create: async () => { state.payments++; } },
        }); } catch (cause) { state = before; throw cause; }
      }); queue = result.catch(() => undefined); return result;
    },
  };
  const service = new OrdersService(prisma, {}, {}, {}, { notify: async () => {}, notifyMany: async () => {} },
    { emitToMerchant: () => {} }, { merchantUserIds: async () => [] },
    { deliveryFeePaisa: () => 8000, serviceFeePaisa: () => 2000, smallOrderFeePaisa: () => 0, commissionPaisa: () => 0 }, {});
  service.detailForCustomer = async (userId, id) => {
    const record = state.orders.find((entry) => entry.id === id);
    assert.equal(record.customerId, userId); return { ...record };
  };
  return { service, state: () => state, fail: (value) => fail = value };
}
const input = { requestId: 'bb63e131-9d1c-4208-a2b8-1a2cbd68b432', deliveryAddressId: 'home', paymentMethod: 'COD' };
test('concurrent same-reference checkout creates one order, payment and stock decrement', async () => {
  const f = fixture();
  const responses = await Promise.all([f.service.placeOrder('customer', input), f.service.placeOrder('customer', input)]);
  assert.equal(responses[0].id, responses[1].id);
  assert.equal(f.state().orders.length, 1); assert.equal(f.state().payments, 1); assert.equal(f.state().stock, 18);
  assert.equal((await f.service.placeOrder('customer', input)).id, input.requestId);
});
test('multi-shop reference belongs to the parent and replays without new children', async () => {
  const f = fixture(true); const first = await f.service.placeOrder('customer', input);
  assert.equal(first.id, input.requestId); assert.equal(first.isParent, true);
  await f.service.placeOrder('customer', input);
  assert.equal(f.state().orders.length, 3); assert.equal(f.state().payments, 1); assert.equal(f.state().stock, 16);
});
test('reference reuse cannot expose another customer or change checkout intent', async () => {
  const f = fixture(); await f.service.placeOrder('customer', input);
  await assert.rejects(f.service.placeOrder('other', input));
  await assert.rejects(f.service.placeOrder('customer', { ...input, deliveryAddressId: 'other-home' }));
  await assert.rejects(f.service.placeOrder('customer', { ...input, paymentMethod: 'CARD' }));
  assert.equal(f.state().orders.length, 1);
});
test('failed transaction restores the basket and stock for same-reference retry', async () => {
  const f = fixture(); f.fail(true);
  await assert.rejects(f.service.placeOrder('customer', input), /Injected write failure/);
  assert.equal(f.state().stock, 20); assert.equal(f.state().active, true);
  f.fail(false); await f.service.placeOrder('customer', input);
  assert.equal(f.state().orders.length, 1); assert.equal(f.state().payments, 1);
});
test('older clients without a reference cannot concurrently spend the same basket twice', async () => {
  const f = fixture(); const { requestId, ...legacy } = input;
  const responses = await Promise.allSettled([f.service.placeOrder('customer', legacy), f.service.placeOrder('customer', legacy)]);
  assert.equal(responses.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(f.state().orders.length, 1); assert.equal(f.state().payments, 1); assert.equal(f.state().stock, 18);
});
