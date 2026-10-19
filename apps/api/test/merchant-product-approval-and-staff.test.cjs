require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { validateSync } = require('class-validator');
const { AdminMarketplaceService } = require('../src/admin/admin-marketplace.service.ts');
const { MerchantPeopleService } = require('../src/merchant/merchant-people.service.ts');
const { CreateStaffDto, ChangeStaffPasswordDto } = require('../src/merchant/merchant.dto.ts');

test('staff password is required and follows the owner-managed password policy', () => {
  const create = { fullName: 'Helper', phoneNumber: '+923001234567', roleName: 'Cashier', permissions: ['POS'] };
  assert.ok(validateSync(Object.assign(new CreateStaffDto(), create)).some((error) => error.property === 'password'));
  for (const password of ['short1', 'NoNumbersHere']) {
    assert.ok(validateSync(Object.assign(new ChangeStaffPasswordDto(), { password })).length > 0);
  }
  assert.equal(validateSync(Object.assign(new CreateStaffDto(), { ...create, password: 'OwnerPicked123' })).length, 0);
});

test('approval reaches the owner and active inventory staff once', async () => {
  const product = { id: 'product', name: 'Apples', approvalStatus: 'PENDING', createdByMerchantId: 'shop' };
  const notifications = [];
  const db = {
    product: {
      findUnique: async () => ({ ...product }),
      updateMany: async ({ where, data }) => {
        if (where.approvalStatus !== product.approvalStatus) return { count: 0 };
        product.approvalStatus = data.approvalStatus;
        return { count: 1 };
      },
    },
    merchant: { findUnique: async () => ({ userId: 'owner', staff: [
      { userId: 'inventory', permissions: '["INVENTORY"]' },
      { userId: 'cashier', permissions: '["POS"]' },
      { userId: 'invalid', permissions: '{' },
    ] }) },
  };
  const service = new AdminMarketplaceService(db, { log: async () => {} }, { notifyMany: async (users, payload) => notifications.push({ users, payload }) }, {}, {}, {});
  await service.setProductApproval('admin', 'product', 'APPROVED');
  await service.setProductApproval('admin', 'product', 'APPROVED');
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0].users, ['owner', 'inventory']);
  assert.equal(notifications[0].payload.type, 'PRODUCT_APPROVED');
});

test('owner assigns a staff password, stored only as a hash', async () => {
  const createdUsers = [];
  const db = {
    user: { findUnique: async () => null },
    merchantStaff: { create: async ({ data }) => ({ id: `staff-${createdUsers.length}`, ...data }) },
  };
  db.user.create = async ({ data }) => { createdUsers.push(data); return { id: `user-${createdUsers.length}` }; };
  db.$transaction = async (operation) => operation(db);
  const service = new MerchantPeopleService(db, { merchantContext: async () => ({ isOwner: true, merchantId: 'shop' }) }, { log: async () => {} }, {});
  const input = { fullName: 'Inventory helper', phoneNumber: '+923001234567', password: 'OwnerPickedPassword1', roleName: 'Inventory assistant', permissions: ['INVENTORY'] };
  const first = await service.createStaff('owner', input);
  const second = await service.createStaff('owner', { ...input, phoneNumber: '+923001234568' });
  assert.equal(await bcrypt.compare(input.password, createdUsers[0].passwordHash), true);
  assert.notEqual(createdUsers[0].passwordHash, createdUsers[1].passwordHash);
  assert.equal(first.temporaryPassword, undefined);
  assert.equal(second.temporaryPassword, undefined);
  assert.equal(first.passwordHash, undefined);
});

test('only the owner can change a staff password within their shop; sessions are revoked', async () => {
  const updates = [];
  const revocations = [];
  const audits = [];
  const db = {
    merchantStaff: { findFirst: async ({ where }) => where.merchantId === 'shop-1' && where.id === 'staff-1' ? { id: 'staff-1', userId: 'staff-user' } : null },
    user: { update: async (args) => { updates.push(args); return {}; } },
    refreshToken: { updateMany: async (args) => { revocations.push(args); return { count: 1 }; } },
    $transaction: async (operations) => Promise.all(operations),
  };
  const access = { merchantContext: async (userId) => ({ isOwner: userId === 'owner' || userId === 'other-owner', merchantId: userId === 'other-owner' ? 'shop-2' : 'shop-1' }) };
  const service = new MerchantPeopleService(db, access, { log: async (entry) => audits.push(entry) }, {});
  await assert.rejects(service.changeStaffPassword('staff-user', 'staff-1', { password: 'NewPassword123' }), /shop owner/);
  await assert.rejects(service.changeStaffPassword('other-owner', 'staff-1', { password: 'NewPassword123' }), /not found/);
  assert.equal(updates.length, 0);
  assert.deepEqual(await service.changeStaffPassword('owner', 'staff-1', { password: 'NewPassword123' }), { changed: true });
  assert.equal(await bcrypt.compare('NewPassword123', updates[0].data.passwordHash), true);
  assert.equal(revocations[0].where.userId, 'staff-user');
  assert.equal(revocations[0].where.revokedAt, null);
  assert.equal(audits[0].action, 'STAFF_PASSWORD_CHANGED');
  assert.equal(JSON.stringify(audits).includes('NewPassword123'), false);
});
