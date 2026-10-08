require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SupportService } = require('../src/support/support.service');
const { audienceAllowed } = require('../src/notifications/notification-audience');

function fixture(ticket, failLookup) {
  const delivered = [];
  const profiles = {
    customer: { id: 'customer-1', userId: 'customer-user' },
    merchant: { id: 'merchant-1', userId: 'merchant-owner' },
    staff: { id: 'staff-1', merchantId: 'merchant-1', userId: 'merchant-staff', status: 'ACTIVE', permissions: '["ORDERS"]' },
    rider: { id: 'rider-1', userId: 'rider-user', isActive: true, approvalStatus: 'APPROVED' },
  };
  const matches = (row, where) => row && Object.entries(where).every(([key, value]) => row[key] === value);
  const db = {
    user: { findUnique: async ({ where }) => where.id ? { status: 'ACTIVE' } : null },
    customer: {
      findFirst: async ({ where }) => { if (failLookup === 'customer') throw Error('private database detail'); return matches(profiles.customer, where) ? { id: profiles.customer.id } : null; },
      findUnique: async ({ where }) => where.userId === profiles.customer.userId ? { id: profiles.customer.id } : null,
    },
    merchant: {
      findFirst: async ({ where }) => { if (failLookup === 'merchant') throw Error('private database detail'); return matches(profiles.merchant, where) ? { id: profiles.merchant.id } : null; },
    },
    merchantStaff: {
      findFirst: async ({ where }) => { if (failLookup === 'merchant') throw Error('private database detail'); return matches(profiles.staff, where) ? { id: profiles.staff.id, permissions: profiles.staff.permissions } : null; },
    },
    rider: {
      findFirst: async ({ where }) => { if (failLookup === 'rider') throw Error('private database detail'); return matches(profiles.rider, where) ? { id: profiles.rider.id } : null; },
    },
    supportTicket: {
      findUnique: async () => ({ ...ticket, messages: [] }),
      update: async ({ data }) => ({ ...ticket, ...data }),
    },
    supportTicketMessage: { create: async () => ({ id: 'reply-1' }) },
  };
  const service = new SupportService(db, {}, { notify: async item => { delivered.push(item); } }, {});
  return { service, delivered, db };
}

const base = { id: 'ticket-1', title: 'Help', status: 'OPEN', issueCategory: 'OTHER',
  customerId: null, merchantId: null, riderId: null, createdByUserId: 'customer-user' };
for (const [name, fields, expected] of [
  ['rider issue with order customer and merchant', { customerId: 'customer-1', merchantId: 'merchant-1', riderId: 'rider-1', createdByUserId: 'rider-user', issueCategory: 'RIDER_ISSUE' }, { audience: 'RIDER', scopeId: 'rider-1', role: 'RIDER' }],
  ['customer ticket', { customerId: 'customer-1' }, { audience: 'CUSTOMER', scopeId: 'customer-user', role: 'CUSTOMER' }],
  ['merchant owner ticket', { merchantId: 'merchant-1', createdByUserId: 'merchant-owner' }, { audience: 'MERCHANT', scopeId: 'merchant-1', role: 'MERCHANT_OWNER' }],
  ['merchant staff ticket', { merchantId: 'merchant-1', createdByUserId: 'merchant-staff' }, { audience: 'MERCHANT', scopeId: 'merchant-1', role: 'MERCHANT_STAFF' }],
]) {
  for (const route of ['reply', 'status']) test(`${route} targets creator context: ${name}`, async () => {
    const { service, delivered, db } = fixture({ ...base, ...fields });
    if (route === 'reply') await service.addMessage('admin-user', 'ADMIN', 'ticket-1', 'We are checking');
    else await service.adminUpdate('admin-user', 'ticket-1', { status: 'IN_REVIEW' });
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].userId, fields.createdByUserId || base.createdByUserId);
    assert.equal(delivered[0].audience, expected.audience);
    assert.equal(delivered[0].scopeId, expected.scopeId);
    assert.equal(await audienceAllowed(db, { userId: delivered[0].userId, role: expected.role },
      { audience: delivered[0].audience, scopeId: delivered[0].scopeId, baseType: delivered[0].type }), true);
  });
}
for (const [name, fields] of [
  ['customer association owned by someone else', { customerId: 'customer-1', createdByUserId: 'rider-user' }],
  ['merchant association owned by someone else', { merchantId: 'merchant-1', createdByUserId: 'customer-user' }],
  ['rider association owned by someone else', { riderId: 'rider-1', createdByUserId: 'customer-user' }],
  ['mixed rider issue with wrong rider creator', { customerId: 'customer-1', merchantId: 'merchant-1', riderId: 'rider-1', createdByUserId: 'customer-user', issueCategory: 'RIDER_ISSUE' }],
  ['mixed ticket without creator-role provenance', { customerId: 'customer-1', merchantId: 'merchant-1', createdByUserId: 'customer-user' }],
]) {
  for (const route of ['reply', 'status']) test(`${route} fails closed: ${name}`, async () => {
    const { service, delivered } = fixture({ ...base, ...fields });
    if (route === 'reply') await service.addMessage('admin-user', 'ADMIN', 'ticket-1', 'We are checking');
    else await service.adminUpdate('admin-user', 'ticket-1', { status: 'IN_REVIEW' });
    assert.equal(delivered.length, 0);
  });
}
for (const [name, fields, lookup] of [
  ['rider', { customerId: 'customer-1', merchantId: 'merchant-1', riderId: 'rider-1', createdByUserId: 'rider-user', issueCategory: 'RIDER_ISSUE' }, 'rider'],
  ['customer', { customerId: 'customer-1' }, 'customer'],
  ['merchant', { merchantId: 'merchant-1', createdByUserId: 'merchant-owner' }, 'merchant'],
]) {
  for (const route of ['reply', 'status']) test(`${route} succeeds without notification when ${name} audience lookup fails`, async () => {
    const { service, delivered } = fixture({ ...base, ...fields }, lookup);
    if (route === 'reply') {
      const reply = await service.addMessage('admin-user', 'ADMIN', 'ticket-1', 'We are checking');
      assert.equal(reply.id, 'reply-1');
    } else {
      const updated = await service.adminUpdate('admin-user', 'ticket-1', { status: 'IN_REVIEW' });
      assert.equal(updated.status, 'IN_REVIEW');
    }
    assert.equal(delivered.length, 0);
  });
}
