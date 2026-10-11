require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addCalendarMonthUtc, merchantPosTrialView, merchantTrial } = require('../src/common/merchant-access-policy.ts');
const { isMerchantOpenAt } = require('../src/common/merchant-hours.ts');
const { MerchantService } = require('../src/merchant/merchant.service.ts');
const { AccessService } = require('../src/common/access.service.ts');
const { AdminMarketplaceService } = require('../src/admin/admin-marketplace.service.ts');

test('trial is one calendar month with month-end/leap-year clamping, not an expiry gate', () => {
  for (const [start, end] of [['2026-01-31', '2026-02-28'], ['2028-01-31', '2028-02-29'], ['2026-12-31', '2027-01-31'], ['2026-10-09', '2026-11-09']]) {
    const value = merchantTrial(`${start}T04:30:00Z`, new Date(`${end}T04:30:00Z`));
    assert.equal(value.endsAt, `${end}T04:30:00.000Z`);
    assert.equal(value.isInTrial, false);
    assert.equal(value.accessContinuesAfterTrial, true);
  }
  assert.equal(merchantTrial('2026-10-09', new Date('2026-10-10')).isInTrial, true);
});

test('POS trial uses one UTC calendar month and expires only POS sales', () => {
  const start = new Date('2026-01-31T12:45:00Z');
  const end = addCalendarMonthUtc(start);
  assert.equal(end.toISOString(), '2026-02-28T12:45:00.000Z');
  assert.equal(merchantPosTrialView({ optedIn: true, startedAt: start, endsAt: end }, new Date('2026-02-01')).salesEnabled, true);
  const expired = merchantPosTrialView({ optedIn: true, startedAt: start, endsAt: end }, end);
  assert.equal(expired.status, 'EXPIRED'); assert.equal(expired.salesEnabled, false); assert.equal(expired.remainingMilliseconds, 0);
  const declined = merchantPosTrialView({ optedIn: false, startedAt: null, endsAt: null });
  assert.equal(declined.status, 'DECLINED'); assert.equal(declined.salesEnabled, false);
  assert.equal(merchantPosTrialView(null).salesEnabled, true);
});

test('weekly merchant hours honor Pakistan local time, closed days and overnight spans', () => {
  const schedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: dayOfWeek === 1, opensAt: '09:00', closesAt: '18:00', closesNextDay: false }));
  assert.equal(isMerchantOpenAt(schedule, '09:00', '18:00', new Date('2026-10-11T06:00:00Z')), true); // Sunday 11:00 PKT
  assert.equal(isMerchantOpenAt(schedule, '09:00', '18:00', new Date('2026-10-12T06:00:00Z')), false); // Monday closed
  const overnight = schedule.map((entry) => entry.dayOfWeek === 0 ? { ...entry, closesAt: '02:00', closesNextDay: true } : entry);
  assert.equal(isMerchantOpenAt(overnight, '09:00', '18:00', new Date('2026-10-11T20:59:00Z')), true); // Monday 01:59 PKT, Sunday overnight
});

test('merchant settings reject contradictory overnight flags before changing records', async () => {
  const invalid = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: false, opensAt: '22:00', closesAt: '02:00', closesNextDay: false }));
  const service = new MerchantService({}, {}, {}, {});
  await assert.rejects(service.onboard('owner', { operatingHours: invalid }), /mark overnight hours/);
});

test('onboarding starts active, stores hours and records an explicit POS choice without changing token flow', async () => {
  let created, audit, tokenRole, savedTrial, savedHours;
  const db = {
    merchant: { findUnique: async () => null, create: async ({ data }) => (created = { ...data, id: 'shop', createdAt: new Date('2026-10-09') }) },
    merchantPosTrial: { create: async ({ data }) => (savedTrial = data) },
    merchantOperatingHours: { createMany: async ({ data }) => (savedHours = data) },
  };
  db.$transaction = async work => work(db);
  const service = new MerchantService(db, {}, { log: async value => { audit = value; } }, { issueTokens: async (user, role) => { tokenRole = [user, role]; return { accessToken: 'test-access', refreshToken: 'test-refresh', user: { id: user } }; } });
  const weeklyHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: dayOfWeek === 0, opensAt: dayOfWeek === 0 ? undefined : '09:00', closesAt: dayOfWeek === 0 ? undefined : '21:00', closesNextDay: false }));
  const response = await service.onboard('owner', { shopName: 'Fixture', shopType: 'GROCERY', city: 'Lahore', address: 'Fixture only', phoneNumber: '+923000000000', latitude: 31.5, longitude: 74.3, posOptIn: true, operatingHours: weeklyHours, deliveryFeePaisa: 5000 });
  assert.equal(created.approvalStatus, 'APPROVED'); assert.equal(created.isOnline, true); assert.equal(created.isOpen, true);
  assert.equal(created.openingTime, '09:00'); assert.equal(created.closingTime, '21:00');
  assert.equal(created.deliveryFeePaisa, 5000); assert.equal(savedHours.length, 7); assert.equal(savedHours[0].opensAt, null);
  assert.equal(savedTrial.userId, 'owner'); assert.equal(savedTrial.optedIn, true); assert.equal(savedTrial.endsAt.toISOString(), addCalendarMonthUtc(savedTrial.startedAt).toISOString());
  assert.deepEqual(tokenRole, ['owner', 'MERCHANT_OWNER']); assert.equal(response.accessToken, 'test-access');
  assert.equal(response.merchant.trial.accessContinuesAfterTrial, true);
  assert.equal(response.merchant.posTrial.status, 'ACTIVE');
  assert.equal(audit.action, 'MERCHANT_ONBOARDED');
  // No user delegate is provided: accidentally overwriting account roles fails this test.
});

test('profile save returns the persisted weekly schedule so the portal does not reset it', async () => {
  let shop = { id: 'shop', openingTime: '09:00', closingTime: '21:00', deliveryFeePaisa: 0 };
  let savedHours = [];
  const db = {
    merchant: {
      update: async ({ data }) => Object.assign(shop, data),
      findUniqueOrThrow: async () => ({ ...shop, operatingHours: structuredClone(savedHours) }),
    },
    merchantOperatingHours: {
      deleteMany: async () => { savedHours = []; },
      createMany: async ({ data }) => { savedHours = structuredClone(data); },
    },
  };
  db.$transaction = async (work) => work(db);
  const service = new MerchantService(db, { merchantContext: async () => ({ merchantId: 'shop' }), requirePermission() {} }, {}, {});
  const schedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: dayOfWeek === 0, opensAt: dayOfWeek === 0 ? undefined : '10:00', closesAt: dayOfWeek === 0 ? undefined : '20:00', closesNextDay: false }));
  const response = await service.updateProfile('owner', { operatingHours: schedule, deliveryFeePaisa: 250 });
  assert.equal(response.deliveryFeePaisa, 250);
  assert.equal(response.operatingHours.length, 7);
  assert.equal(response.operatingHours[1].opensAt, '10:00');
});

test('existing shop cannot be replaced to reset its access/trial', async () => {
  const service = new MerchantService({ merchant: { findUnique: async () => ({ id: 'old' }) } }, {}, {}, {});
  await assert.rejects(service.onboard('owner', {}), /already has a shop/);
});

test('admin-disabled owner and staff operations are blocked, but status remains readable', async () => {
  for (const status of ['SUSPENDED', 'REJECTED', 'INACTIVE']) for (const staff of [false, true]) {
    const access = new AccessService({
      merchant: { findUnique: async () => staff ? null : ({ id: 'shop', approvalStatus: status, user: { status: 'ACTIVE' } }) },
      merchantStaff: { findFirst: async () => ({ merchantId: 'shop', permissions: '["POS"]', user: { status: 'ACTIVE' }, merchant: { approvalStatus: status } }) },
    });
    await assert.rejects(access.merchantContext('owner'), /shop has been disabled/);
    assert.equal((await access.merchantContext('owner', { allowDisabled: true })).merchantId, 'shop');
  }
});

test('expired trial never blocks owner operations; account suspension still does', async () => {
  const shop = { id: 'shop', approvalStatus: 'APPROVED', createdAt: new Date('2020-01-01'), user: { status: 'ACTIVE' } };
  const access = new AccessService({ merchant: { findUnique: async () => shop }, merchantStaff: { findFirst: async () => null } });
  assert.equal((await access.merchantContext('owner')).isOwner, true);
  shop.user.status = 'SUSPENDED';
  await assert.rejects(access.merchantContext('owner', { allowDisabled: true }), /No merchant account/);
});

test('online switch cannot bypass an admin disable between context lookup and saved write', async () => {
  let where;
  const service = new MerchantService({ merchant: { updateMany: async input => { where = input.where; return { count: 0 }; } } }, { merchantContext: async () => ({ merchantId: 'shop' }), requirePermission() {} }, {}, {});
  await assert.rejects(service.setOnline('owner', true), /not active/);
  assert.deepEqual(where, { id: 'shop', approvalStatus: 'APPROVED' });
});

test('admin disable/reactivate atomically stores audit, preserves trial start and tolerates notification failure', async () => {
  let shop = { id: 'shop', shopName: 'Fixture', approvalStatus: 'APPROVED', isOnline: true, isOpen: false, createdAt: new Date('2026-01-31'), user: { id: 'owner' } };
  let failAudit = false, audits = [];
  const db = { merchant: {
    findUnique: async () => structuredClone(shop), findUniqueOrThrow: async () => structuredClone(shop),
    update: async ({ data }) => Object.assign(shop, data),
  }, auditLog: { create: async ({ data }) => { if (failAudit) throw Error('Audit unavailable'); audits.push(data); } } };
  db.$transaction = async work => { const previous = structuredClone(shop); try { return await work(db); } catch (error) { shop = previous; throw error; } };
  const admin = new AdminMarketplaceService(db, {}, { notify: async () => { throw Error('Notification unavailable'); } }, {}, {}, {});
  await admin.setMerchantApproval('admin', 'shop', 'SUSPENDED', 'Fixture disable');
  assert.equal(shop.isOnline, false); assert.equal(shop.approvalStatus, 'SUSPENDED'); assert.equal(audits.length, 1);
  failAudit = true; await assert.rejects(admin.setMerchantApproval('admin', 'shop', 'APPROVED'), /Audit unavailable/);
  assert.equal(shop.approvalStatus, 'SUSPENDED');
  failAudit = false; await admin.setMerchantApproval('admin', 'shop', 'APPROVED');
  assert.equal(shop.approvalStatus, 'APPROVED'); assert.equal(shop.isOnline, true); assert.equal(shop.isOpen, false);
  assert.equal(shop.createdAt.toISOString(), '2026-01-31T00:00:00.000Z');
});
