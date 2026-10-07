require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SupportService } = require('../src/support/support.service');
function fixture() {
  let creates = 0, messages = 0;
  const service = new SupportService({
    customer: { findUnique: async () => ({ id: 'customer' }) },
    order: { findUnique: async ({ where }) => ({ id: where.id, customerId: where.id === 'mine' ? 'customer' : 'other' }) },
    supportTicket: { create: async ({ data }) => { creates++; return { id: 'ticket', ...data }; },
      findUnique: async () => ({ id: 'ticket', createdByUserId: 'other-user', messages: [] }) },
    supportTicketMessage: { create: async () => { messages++; return {}; } },
  }, {}, { emitToAdmins: () => {} });
  return { service, count: () => ({ creates, messages }) };
}
const input = { issueCategory: 'OTHER', title: 'Help', description: 'Please check' };
test('customer support can link only the customer\'s own order', async () => {
  const f = fixture();
  await f.service.create('user', 'CUSTOMER', { ...input, orderId: 'mine' });
  await assert.rejects(f.service.create('user', 'CUSTOMER', { ...input, orderId: 'other-order' }));
  assert.equal(f.count().creates, 1);
});
test('foreign ticket cannot be read or replied to', async () => {
  const f = fixture();
  await assert.rejects(f.service.getForUser('user', 'CUSTOMER', 'ticket'));
  await assert.rejects(f.service.addMessage('user', 'CUSTOMER', 'ticket', 'Unauthorised'));
  assert.equal(f.count().messages, 0);
});
