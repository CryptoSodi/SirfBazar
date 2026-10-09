require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MerchantOrdersService } = require('../src/orders/merchant-orders.service.ts');
const { OrderStatusService } = require('../src/orders/order-status.service.ts');
const { RiderService } = require('../src/rider/rider.service.ts');

// Transactional in-memory adapter exercises the real services, including rollback.
// PostgreSQL contention is covered separately in remediation-database.test.cjs.
function fixture(initial = 'SENT_TO_MERCHANT') {
  let state = {
    orders: [{ id: 'order', orderNumber: 'SB-FLOW', status: initial, merchantId: 'shop', riderId: null, parentOrderId: null, customer: { userId: 'buyer', user: { id: 'buyer' } } }],
    riders: ['r1', 'r2'].map(id => ({ id, merchantId: 'shop', fullName: id, userId: id, approvalStatus: 'APPROVED', isActive: true, currentStatus: 'IDLE', currentOrderId: null })),
    timeline: [],
  };
  const notices = [], broadcasts = [], permissions = [];
  let failPreparing = false, tail = Promise.resolve();
  const matches = (row, where) => Object.entries(where || {}).every(([key, value]) => value && typeof value === 'object' && 'in' in value ? value.in.includes(row[key]) : row[key] === value);
  const delegate = rows => ({
    findFirst: async ({ where }) => structuredClone(rows().find(row => matches(row, where)) ?? null),
    findUnique: async ({ where }) => structuredClone(rows().find(row => matches(row, where)) ?? null),
    findUniqueOrThrow: async ({ where }) => { const row = rows().find(row => matches(row, where)); if (!row) throw Error('Missing fixture'); return structuredClone(row); },
    updateMany: async ({ where, data }) => { const selected = rows().filter(row => matches(row, where)); for (const row of selected) Object.assign(row, data); return { count: selected.length }; },
  });
  const db = {
    order: delegate(() => state.orders), rider: delegate(() => state.riders),
    merchant: { findUnique: async () => ({ shopName: 'Fixture Shop' }) },
    orderTimelineEntry: { create: async ({ data }) => { if (failPreparing && data.status === 'PREPARING') throw Error('Fixture timeline failure'); state.timeline.push(data); return data; } },
    $transaction: async work => {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; });
      await previous; const before = structuredClone(state);
      try { return await work(db); } catch (e) { state = before; throw e; } finally { release(); }
    },
  };
  const access = {
    merchantContext: async user => ({ merchantId: user === 'foreign' ? 'other' : 'shop' }),
    requirePermission: (_ctx, permission) => { permissions.push(permission); if (permission === 'RIDERS' && access.denyRiders) throw Error('Rider permission required'); },
    riderByUser: async id => db.rider.findUniqueOrThrow({ where: { id } }),
  };
  const realtime = Object.fromEntries(['emitToOrder', 'emitToMerchant', 'emitToUser', 'emitToRider', 'emitToAdmins'].map(key => [key, (...args) => broadcasts.push([key, ...args])]));
  const notifications = { notify: async notice => { notices.push(notice); } };
  const statuses = new OrderStatusService(db, realtime);
  return { dispatch: new MerchantOrdersService(db, access, notifications, realtime, {}, statuses), riderService: new RiderService(db, access, notifications, realtime, statuses, {}), db, access, notices, broadcasts, permissions, state: () => state, failPreparing: () => { failPreparing = true; } };
}

test('one acceptance commits acceptance and preparation, broadcasting only the saved final status', async () => {
  const f = fixture();
  assert.deepEqual(await f.dispatch.accept('owner', 'order'), { ok: true, status: 'PREPARING' });
  assert.equal(f.state().orders[0].status, 'PREPARING');
  assert.ok(f.state().orders[0].acceptedAt instanceof Date);
  assert.deepEqual(f.state().timeline.map(entry => entry.status), ['MERCHANT_ACCEPTED', 'PREPARING']);
  assert.ok(f.broadcasts.every(([, , event, payload]) => event !== 'order:update' || payload.status === 'PREPARING'));
  assert.match(f.notices[0].body, /is preparing/);
});

test('failed preparation rolls back acceptance, timestamps, timeline and notification', async () => {
  const f = fixture(); f.failPreparing();
  await assert.rejects(f.dispatch.accept('owner', 'order'), /timeline failure/);
  assert.equal(f.state().orders[0].status, 'SENT_TO_MERCHANT');
  assert.equal(f.state().orders[0].acceptedAt, undefined);
  assert.equal(f.state().timeline.length, 0);
  assert.equal(f.notices.length, 0); assert.equal(f.broadcasts.length, 0);
});

test('competing accepts have only one durable winner', async () => {
  const f = fixture();
  const result = await Promise.allSettled([f.dispatch.accept('owner', 'order'), f.dispatch.accept('owner', 'order')]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state().timeline.length, 2); assert.equal(f.notices.length, 1);
});

test('early assignment keeps Preparing, blocks rider pickup and becomes pickup-enabled only after packing', async () => {
  const f = fixture('PREPARING');
  const result = await f.dispatch.assignRider('owner', 'order', 'r1');
  assert.equal(result.status, 'PREPARING'); assert.equal(result.rider.id, 'r1');
  assert.equal(f.state().riders[0].currentOrderId, 'order');
  assert.equal(f.state().orders[0].riderId, 'r1');
  await assert.rejects(f.riderService.pickedUp('r1', 'order'));
  await assert.rejects(f.riderService.arrivedAtShop('r1', 'order'));
  assert.match(f.notices.find(n => n.audience === 'RIDER').body, /Wait for the shop/);
  assert.equal((await f.dispatch.markReady('owner', 'order')).status, 'RIDER_ASSIGNED');
  assert.ok(f.state().orders[0].readyForPickupAt);
  assert.equal((await f.riderService.pickedUp('r1', 'order')).status, 'ON_THE_WAY');
});

test('ready without a rider keeps the existing ready-then-assign workflow', async () => {
  const f = fixture('PREPARING');
  assert.equal((await f.dispatch.markReady('owner', 'order')).status, 'READY_FOR_PICKUP');
  assert.equal((await f.dispatch.assignRider('owner', 'order', 'r1')).status, 'RIDER_ASSIGNED');
});

test('two riders cannot replace each other on a preparing order; loser reservation rolls back', async () => {
  const f = fixture('PREPARING');
  const attempts = await Promise.allSettled(['r1', 'r2'].map(rider => f.dispatch.assignRider('owner', 'order', rider)));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state().riders.filter(r => r.currentOrderId === 'order').length, 1);
  await assert.rejects(f.dispatch.assignRider('owner', 'order', f.state().orders[0].riderId), /already has a rider/);
  assert.equal(f.notices.length, 2);
});

test('one rider cannot be reserved for two preparing orders', async () => {
  const f = fixture('PREPARING');
  f.state().orders.push({ ...structuredClone(f.state().orders[0]), id: 'order2' });
  const attempts = await Promise.allSettled(['order', 'order2'].map(order => f.dispatch.assignRider('owner', order, 'r1')));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state().orders.filter(o => o.riderId === 'r1').length, 1);
});

test('assignment and readiness racing converge to a packed assigned order', async () => {
  for (const readyFirst of [true, false]) {
    const f = fixture('PREPARING');
    const operations = [() => f.dispatch.markReady('owner', 'order'), () => f.dispatch.assignRider('owner', 'order', 'r1')];
    if (!readyFirst) operations.reverse();
    await Promise.all(operations.map(work => work()));
    assert.equal(f.state().orders[0].status, 'RIDER_ASSIGNED'); assert.ok(f.state().orders[0].readyForPickupAt);
  }
});

test('foreign orders, riders, missing permission and inactive/unapproved/busy riders cannot be assigned', async () => {
  const f = fixture('PREPARING');
  await assert.rejects(f.dispatch.assignRider('foreign', 'order', 'r1'), /not found/);
  f.state().riders[0].merchantId = 'other';
  await assert.rejects(f.dispatch.assignRider('owner', 'order', 'r1'), /does not belong/);
  f.state().riders[0].merchantId = 'shop';
  f.access.denyRiders = true;
  await assert.rejects(f.dispatch.assignRider('owner', 'order', 'r1'), /permission/);
  f.access.denyRiders = false;
  for (const change of [{ isActive: false }, { approvalStatus: 'PENDING' }, { currentStatus: 'ASSIGNED' }, { currentOrderId: 'other-order' }]) {
    const before = { ...f.state().riders[0] }; Object.assign(f.state().riders[0], change);
    await assert.rejects(f.dispatch.assignRider('owner', 'order', 'r1'));
    Object.assign(f.state().riders[0], before);
  }
  assert.equal(f.state().orders[0].riderId, null);
});
