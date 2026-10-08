require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { AuthService } = require('../src/auth/auth.service.ts');

test('OTP response advertises configured resend cooldown even when delivery is unconfirmed', async () => {
  const prior = process.env.OTP_RESEND_COOLDOWN_SECONDS;
  process.env.OTP_RESEND_COOLDOWN_SECONDS = '120';
  try {
    const auth = new AuthService({}, {}, {}, {});
    auth.createOtp = async () => ({ id: 'fixture-otp' });
    auth.deliverOtp = async () => 'unconfirmed';
    const result = await auth.sendOtp('+923001234567');
    assert.equal(result.resendAfterSeconds, 120);
    assert.equal(result.status, 'unconfirmed');
    assert.ok(result.expiresInSeconds > 0);
  } finally {
    if (prior === undefined) delete process.env.OTP_RESEND_COOLDOWN_SECONDS;
    else process.env.OTP_RESEND_COOLDOWN_SECONDS = prior;
  }
});

const hash = (token) => createHash('sha256').update(token).digest('hex');
function fixture() {
  const initial = { id: 'old', userId: 'operator', tokenHash: hash('old-secret'), role: 'ADMIN', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
  let rows = [initial], sequence = 1, queue = Promise.resolve(), failSign = false;
  const user = { id: 'operator', role: 'ADMIN', status: 'ACTIVE', passwordHash: null, cnic: null };
  const prisma = {
    $transaction(work, options) {
      assert.equal(options.isolationLevel, 'Serializable');
      const result = queue.then(async () => {
        const snapshot = rows.map((row) => ({ ...row }));
        const tx = {
          pushToken: { findMany: async () => [] },
          webPushSubscription: { findMany: async () => [] },
          refreshToken: {
            findUnique: async ({ where }) => rows.find((row) => row.tokenHash === where.tokenHash) ?? null,
            updateMany: async ({ where, data }) => {
              const row = rows.find((entry) => entry.id === where.id && entry.revokedAt === null && entry.expiresAt > where.expiresAt.gt);
              if (!row) return { count: 0 };
              row.revokedAt = data.revokedAt;
              return { count: 1 };
            },
            create: async ({ data }) => {
              const row = { ...data, id: `next-${sequence++}`, revokedAt: null };
              rows.push(row);
              return row;
            },
          },
          user: {
            findUnique: async () => user,
            update: async () => user,
          },
        };
        try { return await work(tx); }
        catch (error) { rows = snapshot; throw error; }
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
  const jwt = { signAsync: async ({ sid }) => { if (failSign) throw Error('Signing unavailable'); return `access:${sid}`; } };
  const service = new AuthService(prisma, jwt, {}, {});
  return { service, rows: () => rows, failSigning(value) { failSign = value; } };
}

test('two refreshes of one credential commit exactly one successor', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.service.refreshTokens('old-secret'), f.service.refreshTokens('old-secret')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(f.rows().filter((row) => row.id !== 'old').length, 1);
  assert.ok(f.rows().find((row) => row.id === 'old').revokedAt);
});

test('failed successor signing restores original claim for a later retry', async () => {
  const f = fixture();
  f.failSigning(true);
  await assert.rejects(f.service.refreshTokens('old-secret'), /Signing unavailable/);
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0].revokedAt, null);
  f.failSigning(false);
  const renewed = await f.service.refreshTokens('old-secret');
  assert.equal(renewed.accessToken, 'access:next-2');
  assert.equal(f.rows().length, 2);
});
