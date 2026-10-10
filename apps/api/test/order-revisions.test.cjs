require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MerchantOrdersService } = require('../src/orders/merchant-orders.service.ts');
const { OrdersService } = require('../src/orders/orders.service.ts');
const { OrderStatusService } = require('../src/orders/order-status.service.ts');

function fixture() {
  const now = new Date();
  const item = {
    id: 'item-1', orderId: 'order-1', productId: 'product-1', merchantProductId: 'listing-1',
    productNameSnapshot: 'Rice', productImageSnapshot: null, unitSnapshot: 'kg', quantity: 2,
    unitPricePaisa: 500, totalPricePaisa: 1000, itemStatus: 'CONFIRMED',
  };
  const secondItem = {
    id: 'item-2', orderId: 'order-1', productId: 'product-2', merchantProductId: 'listing-2',
    productNameSnapshot: 'Milk', productImageSnapshot: null, unitSnapshot: 'L', quantity: 1,
    unitPricePaisa: 300, totalPricePaisa: 300, itemStatus: 'CONFIRMED',
  };
  const order = {
    id: 'order-1', orderNumber: 'SB-100', merchantId: 'shop-1', customerId: 'customer-1',
    channel: 'ONLINE', paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'SENT_TO_MERCHANT',
    riderId: null, parentOrderId: null, couponCode: null, discountAmountPaisa: 0,
    subtotalPaisa: 1300, deliveryFeePaisa: 100, serviceFeePaisa: 0, smallOrderFeePaisa: 0,
    totalAmountPaisa: 1400, merchant: {}, customer: { userId: 'buyer-1' }, items: [item, secondItem],
  };
  let state = { order, revisions: [], timeline: [], listings: [
    { id: 'listing-1', merchantId: 'shop-1', stockQuantity: 0 },
    { id: 'listing-2', merchantId: 'shop-1', stockQuantity: 4 },
    { id: 'listing-3', merchantId: 'shop-1', productId: 'product-3', stockQuantity: 3, isAvailable: true, pricePaisa: 400, discountPricePaisa: null,
      product: { id: 'product-3', name: 'Tea', imageUrl: null, unit: 'pack', approvalStatus: 'APPROVED', isRestricted: false, requiresPrescription: false, category: { isRestricted: false, isActive: true } } },
  ] };
  const same = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'order') return value.customerId === state.order.customerId;
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
    if (value && typeof value === 'object' && 'lte' in value) return row[key] <= value.lte;
    if (value && typeof value === 'object' && 'gt' in value) return row[key] > value.gt;
    return row[key] === value;
  });
  const db = {
    order: {
      findFirst: async ({ where }) => same(state.order, where) ? structuredClone({ ...state.order, items: state.order.items }) : null,
      findUnique: async ({ where }) => where.id === state.order.id ? structuredClone(state.order) : null,
      findUniqueOrThrow: async ({ where }) => {
        if (where.id !== state.order.id) throw new Error('Missing fixture order');
        return structuredClone(state.order);
      },
      findMany: async ({ where }) => where.parentOrderId ? [] : [],
      update: async ({ where, data }) => {
        assert.equal(where.id, state.order.id);
        Object.assign(state.order, data);
        return structuredClone(state.order);
      },
      updateMany: async ({ where, data }) => {
        if (!same(state.order, where)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    orderRevision: {
      findUnique: async ({ where }) => structuredClone(state.revisions.find((row) => row.requestId === where.requestId) ?? null),
      findFirst: async ({ where }) => {
        const row = state.revisions.find((entry) => same(entry, where) && (!where.order || entry.orderId === state.order.id));
        return row ? structuredClone({ ...row, ...(where.order ? { order: state.order } : {}) }) : null;
      },
      findMany: async () => structuredClone(state.revisions),
      create: async ({ data }) => {
        const row = { id: `revision-${state.revisions.length + 1}`, status: 'PENDING', createdAt: now, resolvedAt: null, resolvedByUserId: null, ...structuredClone(data) };
        state.revisions.push(row);
        return structuredClone(row);
      },
      updateMany: async ({ where, data }) => {
        const row = state.revisions.find((entry) => same(entry, where));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    merchantProduct: {
      findFirst: async ({ where }) => structuredClone(state.listings.find((row) => row.id === where.id && row.merchantId === where.merchantId && (where.isAvailable === undefined || row.isAvailable === where.isAvailable)) ?? null),
      updateMany: async ({ where, data }) => {
        const row = state.listings.find((entry) => entry.id === where.id && entry.merchantId === where.merchantId);
        if (!row) return { count: 0 };
        if (where.stockQuantity?.gte !== undefined && row.stockQuantity < where.stockQuantity.gte) return { count: 0 };
        if (where.pricePaisa !== undefined && row.pricePaisa !== where.pricePaisa) return { count: 0 };
        if (where.discountPricePaisa !== undefined && row.discountPricePaisa !== where.discountPricePaisa) return { count: 0 };
        if (where.isAvailable !== undefined && row.isAvailable !== where.isAvailable) return { count: 0 };
        if (where.product && Object.entries(where.product).some(([key, value]) => key === 'category'
          ? Object.entries(value).some(([nestedKey, nestedValue]) => row.product?.category?.[nestedKey] !== nestedValue)
          : row.product?.[key] !== value)) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
          else if (value && typeof value === 'object' && 'decrement' in value) row[key] -= value.decrement;
          else row[key] = value;
        }
        return { count: 1 };
      },
    },
    orderItem: {
      updateMany: async ({ where, data }) => {
        const row = state.order.items.find((entry) => entry.id === where.id && entry.orderId === where.orderId && entry.itemStatus === where.itemStatus && entry.quantity === where.quantity);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      create: async ({ data }) => { state.order.items.push({ id: `item-${state.order.items.length + 1}`, ...data }); return data; },
    },
    orderTimelineEntry: { create: async ({ data }) => { state.timeline.push(data); return data; } },
    $transaction: async (work) => {
      const before = structuredClone(state);
      try { return await work(db); } catch (error) { state = before; throw error; }
    },
  };
  const access = {
    merchantContext: async (userId) => ({ merchantId: userId === 'foreign' ? 'other-shop' : 'shop-1' }),
    requirePermission: () => {},
    customerId: async (userId) => userId === 'buyer-1' ? 'customer-1' : 'other-customer',
    merchantUserIds: async () => ['merchant-user'],
  };
  const notices = [];
  const notifications = { notify: async (notice) => { notices.push(notice); }, notifyMany: async (users, notice) => { notices.push({ users, ...notice }); } };
  const status = { appendTimeline: async (orderId, event, actor) => { state.timeline.push({ orderId, status: event, ...actor }); } };
  const merchantOrders = new MerchantOrdersService(db, access, notifications, {}, { smallOrderFeeForSubtotal: () => 0 }, status);
  const orders = Object.create(OrdersService.prototype);
  Object.assign(orders, {
    prisma: db,
    access,
    notifications,
    statusService: status,
    pricing: { smallOrderFeePaisa: () => 0, commissionPaisa: () => 0 },
    smallOrderFeeForSubtotal: () => 0,
    detailForCustomer: async () => structuredClone(state.order),
  });
  return { merchantOrders, orders, db, state: () => state, notices };
}

const requestId = 'cdb66e7d-7f9f-4f09-bae0-73c545f2ff44';

test('merchant proposal is pending and leaves the confirmed order and stock untouched', async () => {
  const f = fixture();
  const revision = await f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]);
  assert.equal(revision.status, 'PENDING');
  assert.equal(revision.proposedTotalPaisa, 400);
  assert.equal(f.state().order.items[0].itemStatus, 'CONFIRMED');
  assert.equal(f.state().order.totalAmountPaisa, 1400);
  assert.equal(f.state().listings[0].stockQuantity, 0);
  assert.equal(f.state().timeline[0].status, 'ORDER_REVISION_PROPOSED');
});

test('proposal retries with the same key are idempotent; key reuse with different intent conflicts', async () => {
  const f = fixture();
  const changes = [{ originalItemId: 'item-1', action: 'REMOVE' }];
  const first = await f.merchantOrders.createRevision('owner', 'order-1', requestId, changes);
  const replay = await f.merchantOrders.createRevision('owner', 'order-1', requestId, changes);
  assert.equal(replay.id, first.id);
  assert.equal(f.state().revisions.length, 1);
  await assert.rejects(f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REDUCE', quantity: 1 }]), /already in use/);
});

test('a concurrent unique-key collision returns the already-saved identical proposal', async () => {
  const f = fixture();
  const changes = [{ originalItemId: 'item-1', action: 'REMOVE' }];
  const saved = await f.merchantOrders.createRevision('owner', 'order-1', requestId, changes);
  f.db.$transaction = async () => { const error = new Error('unique constraint'); error.code = 'P2002'; throw error; };
  const replay = await f.merchantOrders.createRevision('owner', 'order-1', requestId, changes);
  assert.equal(replay.id, saved.id);
  assert.equal(f.state().revisions.length, 1);
});

test('another shop cannot propose a revision and discounted or non-COD orders are blocked', async () => {
  const f = fixture();
  await assert.rejects(f.merchantOrders.createRevision('foreign', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]), /not found/);
  f.state().order.paymentMethod = 'CARD';
  await assert.rejects(f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]), /cash on delivery only/);
  f.state().order.paymentMethod = 'COD';
  f.state().order.discountAmountPaisa = 1;
  await assert.rejects(f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]), /coupon or discount/);
});

test('a revision cannot remove every product from the order', async () => {
  const f = fixture();
  await assert.rejects(f.merchantOrders.createRevision('owner', 'order-1', requestId, [
    { originalItemId: 'item-1', action: 'REMOVE' },
    { originalItemId: 'item-2', action: 'REMOVE' },
  ]), /at least one product/);
  assert.equal(f.state().revisions.length, 0);
});

test('customer approval applies the change, restores removed stock and recalculates the order total', async () => {
  const f = fixture();
  const revision = await f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]);
  await f.orders.respondToRevision('buyer-1', 'order-1', revision.id, true);
  assert.equal(f.state().revisions[0].status, 'APPROVED');
  assert.equal(f.state().order.items[0].itemStatus, 'REMOVED');
  assert.equal(f.state().listings[0].stockQuantity, 2);
  assert.equal(f.state().order.subtotalPaisa, 300);
  assert.equal(f.state().order.totalAmountPaisa, 400);
  assert.ok(f.state().timeline.some((entry) => entry.status === 'ORDER_REVISION_APPROVED'));
});

test('replacement proposal rechecks stock and price atomically before changing inventory', async () => {
  const f = fixture();
  const revision = await f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REPLACE', replacementMerchantProductId: 'listing-3' }]);
  f.state().listings[2].stockQuantity = 1;
  await assert.rejects(f.orders.respondToRevision('buyer-1', 'order-1', revision.id, true), /stock or price changed/);
  assert.equal(f.state().revisions[0].status, 'PENDING');
  assert.equal(f.state().order.items[0].itemStatus, 'CONFIRMED');
  assert.equal(f.state().listings[0].stockQuantity, 0);
  assert.equal(f.state().listings[2].stockQuantity, 1);
});

test('fulfillment cannot advance while a revision awaits customer approval', async () => {
  const f = fixture();
  const revision = await f.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]);
  const tx = {
    order: { findUnique: async () => ({ id: 'order-1', status: 'PREPARING', parentOrderId: null }) },
    orderRevision: { findFirst: async () => ({ id: revision.id }) },
  };
  await assert.rejects(
    new OrderStatusService({}, {}).applyInTransaction(tx, 'order-1', 'READY_FOR_PICKUP', { role: 'MERCHANT' }),
    /approval is required/,
  );
});

test('customer rejection and expiry preserve the original order and do not change stock', async () => {
  const rejected = fixture();
  const revision = await rejected.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]);
  await rejected.orders.respondToRevision('buyer-1', 'order-1', revision.id, false);
  assert.equal(rejected.state().revisions[0].status, 'REJECTED');
  assert.equal(rejected.state().order.items[0].itemStatus, 'CONFIRMED');
  assert.equal(rejected.state().listings[0].stockQuantity, 0);

  const expired = fixture();
  const expiredRevision = await expired.merchantOrders.createRevision('owner', 'order-1', requestId, [{ originalItemId: 'item-1', action: 'REMOVE' }]);
  expired.state().revisions[0].expiresAt = new Date(Date.now() - 1_000);
  await assert.rejects(expired.orders.respondToRevision('buyer-1', 'order-1', expiredRevision.id, true), /expired/);
  assert.equal(expired.state().revisions[0].status, 'EXPIRED');
  assert.equal(expired.state().order.items[0].itemStatus, 'CONFIRMED');
  assert.equal(expired.state().listings[0].stockQuantity, 0);
});
