const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RealtimeGateway } = require('../src/realtime/realtime.gateway.ts');

function socket(id, userId, role, sessionId = 'session-1') {
  return {
    id, data: { userId, role, sessionId, authReady: Promise.resolve() }, left: [], joined: [], disconnected: false,
    join(room) { this.joined.push(room); },
    leave(room) { this.left.push(room); },
    disconnect() { this.disconnected = true; },
  };
}

test('live room emission rechecks session, membership, assignment and fails closed', async () => {
  const state = { status: 'ACTIVE', session: true, riderActive: true, riderApproval: 'APPROVED', staffActive: true, ownerActive: true, staffOrders: true, orderRider: 'rider-user', dbError: false };
  const prisma = {
    user: { findUnique: async ({ where }) => {
      if (state.dbError) throw new Error('database unavailable');
      return {
        status: state.status,
        role: 'CUSTOMER',
        customer: where.id === 'customer-user' ? { id: 'customer-1' } : null,
        merchant: null,
        staffOf: where.id === 'staff-user' && state.staffActive && state.ownerActive ? [{ id: 'staff-1' }] : [],
        rider: where.id === 'rider-user' ? { id: 'rider-1', isActive: state.riderActive, approvalStatus: state.riderApproval } : null,
      };
    } },
    refreshToken: { findFirst: async () => state.session ? { id: 'session-1' } : null },
    merchantStaff: { findFirst: async () => state.staffActive && state.ownerActive ? { id: 'staff-1', permissions: JSON.stringify(state.staffOrders ? ['ORDERS'] : ['PRODUCTS']) } : null },
    order: { findUnique: async () => ({
      customer: { userId: 'customer-user' }, merchantId: 'merchant-1', merchant: { userId: 'owner-user' },
      rider: { userId: state.orderRider, isActive: state.riderActive },
    }) },
  };
  const gateway = new RealtimeGateway({}, prisma);
  const subscribers = [];
  const sent = [];
  gateway.server = {
    in: () => ({ fetchSockets: async () => subscribers }),
    to: (id) => ({ emit: (event, payload) => sent.push({ id, event, payload }) }),
  };
  const emit = (room) => gateway.emitAuthorized(room, 'order:update', { orderId: 'order-1' });
  const rider = socket('socket-rider', 'rider-user', 'RIDER');
  subscribers.push(rider);
  await emit('order:order-1');
  assert.equal(sent.length, 1, 'active assigned rider receives the event');
  state.orderRider = 'another-rider';
  await emit('order:order-1');
  assert.equal(sent.length, 1, 'lost assignment receives nothing');
  assert.deepEqual(rider.left, ['order:order-1']);
  state.orderRider = 'rider-user';
  state.riderApproval = 'PENDING';
  await emit('order:order-1');
  assert.equal(sent.length, 1, 'pending rider receives no order event');
  assert.equal(rider.disconnected, true, 'pending rider socket is disconnected');
  state.riderApproval = 'APPROVED';
  subscribers.splice(0, 1, socket('socket-rider-inactive', 'rider-user', 'RIDER'));
  state.riderActive = false;
  await emit('order:order-1');
  assert.equal(sent.length, 1);
  assert.equal(rider.disconnected, true, 'inactive rider socket is disconnected');

  subscribers.splice(0, 1, socket('socket-staff', 'staff-user', 'MERCHANT_STAFF'));
  await emit('merchant:merchant-1');
  assert.equal(sent.length, 2, 'active staff receives merchant event');
  state.staffOrders = false;
  assert.deepEqual(await gateway.joinMerchant(subscribers[0], { merchantId: 'merchant-1' }), { ok: false });
  assert.deepEqual(await gateway.joinOrder(subscribers[0], { orderId: 'order-1' }), { ok: false });
  await emit('merchant:merchant-1');
  assert.equal(sent.length, 2, 'staff without ORDERS permission receives nothing');
  assert.deepEqual(subscribers[0].left, ['merchant:merchant-1']);
  state.staffOrders = true;
  state.ownerActive = false;
  subscribers.splice(0, 1, socket('socket-owner-suspended', 'staff-user', 'MERCHANT_STAFF'));
  await emit('order:order-1');
  assert.equal(sent.length, 2, 'suspended merchant owner revokes staff order feed');
  assert.equal(subscribers[0].disconnected, true);
  state.ownerActive = true;
  subscribers.splice(0, 1, socket('socket-staff-revoked', 'staff-user', 'MERCHANT_STAFF'));
  state.staffActive = false;
  await emit('merchant:merchant-1');
  assert.equal(sent.length, 2);
  assert.equal(subscribers[0].disconnected, true, 'revoked staff disconnects');

  subscribers.splice(0, 1, socket('socket-customer', 'customer-user', 'CUSTOMER'));
  await emit('user:customer-user');
  assert.equal(sent.length, 3);
  state.session = false;
  await emit('user:customer-user');
  assert.equal(sent.length, 3);
  assert.equal(subscribers[0].disconnected, true, 'revoked session disconnects');
  state.session = true;
  state.status = 'SUSPENDED';
  subscribers.splice(0, 1, socket('socket-suspended', 'customer-user', 'CUSTOMER'));
  await emit('user:customer-user');
  assert.equal(sent.length, 3);
  assert.equal(subscribers[0].disconnected, true, 'suspended account disconnects');
  state.status = 'ACTIVE';
  state.dbError = true;
  subscribers.splice(0, 1, socket('socket-error', 'customer-user', 'CUSTOMER'));
  await emit('user:customer-user');
  assert.equal(sent.length, 3, 'database error fails closed');
});
