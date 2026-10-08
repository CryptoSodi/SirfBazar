require('reflect-metadata');
const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { PrismaService } = require('../src/prisma/prisma.service.ts');
const { ExpoPushService } = require('../src/notifications/expo-push.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { latestRegistration, registrationCanReceive, registrationId, registerForSession, pruneFailedRegistration } = require('../src/notifications/notification-registration.ts');

const url = require('./disposable-database.cjs').disposableUrl();
const prisma = new PrismaService();
before(async () => assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'sirfbazar_remediation_test'));
after(async () => prisma.$disconnect());
const hash = (value) => createHash('sha256').update(value).digest('hex');

test('registration transfers atomically with refresh and old-session logout cannot revoke winner', async () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+97${suffix}` } });
  await prisma.customer.create({ data: { userId: user.id } });
  const secret = randomUUID();
  const old = await prisma.refreshToken.create({ data: { userId: user.id, role: 'CUSTOMER', tokenHash: hash(secret), expiresAt: new Date(Date.now() + 60_000) } });
  const token = `ExpoPushToken[${suffix}]`;
  const push = new ExpoPushService(prisma);
  await push.saveToken({ userId: user.id, role: 'CUSTOMER', sessionId: old.id }, token, 'android');
  const context = { audience: 'CUSTOMER', scopeId: user.id, baseType: 'ORDER_PLACED' };
  assert.equal(await registrationCanReceive(prisma, 'expo', token, user.id, context), true);
  const auth = new AuthService(prisma, { signAsync: async ({ sid }) => `access:${sid}` }, {}, {});
  const next = await auth.refreshTokens(secret);
  const transferred = await latestRegistration(prisma, registrationId('expo', token));
  assert.equal(transferred.action, 'TRANSFER');
  assert.equal(await registrationCanReceive(prisma, 'expo', token, user.id, context), true);
  await auth.logout(secret);
  assert.ok(await prisma.pushToken.findUnique({ where: { token } }), 'stale old-session cleanup preserves transferred registration');
  assert.equal(await registrationCanReceive(prisma, 'expo', token, user.id, context), true);
  await auth.logout(next.refreshToken);
  assert.equal(await prisma.pushToken.findUnique({ where: { token } }), null);
  assert.equal((await latestRegistration(prisma, registrationId('expo', token))).action, 'REVOKE');
  assert.equal(await registrationCanReceive(prisma, 'expo', token, user.id, context), false);
});

test('older login cannot overwrite newer same-account web registration', async () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+97${suffix}` } });
  await prisma.customer.create({ data: { userId: user.id } });
  const older = await prisma.refreshToken.create({ data: { userId: user.id, role: 'CUSTOMER', tokenHash: hash(randomUUID()), createdAt: new Date(Date.now() - 2000), expiresAt: new Date(Date.now() + 60_000) } });
  const newer = await prisma.refreshToken.create({ data: { userId: user.id, role: 'CUSTOMER', tokenHash: hash(randomUUID()), createdAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 60_000) } });
  const endpoint = `https://push.example.test/${suffix}`;
  await registerForSession(prisma, { userId: user.id, role: 'CUSTOMER', sessionId: newer.id }, 'web', endpoint);
  await assert.rejects(
    registerForSession(prisma, { userId: user.id, role: 'CUSTOMER', sessionId: older.id }, 'web', endpoint),
    /newer session owns this device/,
  );
  const winner = await latestRegistration(prisma, registrationId('web', endpoint));
  assert.equal(winner.sessionId, newer.id);
});

test('late provider failure cannot prune a device reassigned during delivery', async () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+97${suffix}` } });
  await prisma.customer.create({ data: { userId: user.id } });
  const first = await prisma.refreshToken.create({ data: { userId: user.id, role: 'CUSTOMER', tokenHash: hash(randomUUID()), createdAt: new Date(Date.now() - 2000), expiresAt: new Date(Date.now() + 60_000) } });
  const second = await prisma.refreshToken.create({ data: { userId: user.id, role: 'CUSTOMER', tokenHash: hash(randomUUID()), createdAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 60_000) } });
  const token = `ExpoPushToken[${suffix}]`;
  const push = new ExpoPushService(prisma);
  await push.saveToken({ userId: user.id, role: 'CUSTOMER', sessionId: first.id }, token, 'android');
  const sent = await latestRegistration(prisma, registrationId('expo', token));
  await push.saveToken({ userId: user.id, role: 'CUSTOMER', sessionId: second.id }, token, 'android');
  await pruneFailedRegistration(prisma, 'expo', token, sent);
  assert.equal((await latestRegistration(prisma, registrationId('expo', token))).sessionId, second.id);
  assert.ok(await prisma.pushToken.findUnique({ where: { token } }));
  const endpoint = `https://push.example.test/${suffix}`;
  await prisma.webPushSubscription.create({ data: { userId: user.id, endpoint, p256dh: 'public', auth: 'auth' } });
  await registerForSession(prisma, { userId: user.id, role: 'CUSTOMER', sessionId: first.id }, 'web', endpoint);
  const webSent = await latestRegistration(prisma, registrationId('web', endpoint));
  await registerForSession(prisma, { userId: user.id, role: 'CUSTOMER', sessionId: second.id }, 'web', endpoint);
  await pruneFailedRegistration(prisma, 'web', endpoint, webSent);
  assert.equal((await latestRegistration(prisma, registrationId('web', endpoint))).sessionId, second.id);
  assert.ok(await prisma.webPushSubscription.findUnique({ where: { endpoint } }));
});
