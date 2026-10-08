require('reflect-metadata');
const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { PrismaService } = require('../src/prisma/prisma.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');

const url = require('./disposable-database.cjs').disposableUrl();
const prisma = new PrismaService();
before(async () => assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'sirfbazar_remediation_test'));
after(async () => prisma.$disconnect());
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function adminSession() {
  const id = randomUUID();
  const user = await prisma.user.create({ data: { role: 'ADMIN', status: 'ACTIVE', phoneNumber: `+92${id.replace(/\D/g, '').slice(0, 10).padEnd(10, '0')}` } });
  const secret = randomUUID();
  const session = await prisma.refreshToken.create({ data: { userId: user.id, role: 'ADMIN', tokenHash: hash(secret), expiresAt: new Date(Date.now() + 60_000) } });
  return { user, secret, session };
}

test('barriered concurrent refresh has exactly one committed successor', async () => {
  const { user, secret, session } = await adminSession();
  let arrivals = 0, release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const proxy = {
    $transaction: (work, options) => prisma.$transaction(async (tx) => {
      const wrapped = new Proxy(tx, { get(target, key) {
        if (key !== 'refreshToken') return target[key];
        return new Proxy(target.refreshToken, { get(delegate, method) {
          if (method !== 'findUnique') return delegate[method];
          return async (args) => {
            const row = await delegate.findUnique(args);
            if (arrivals < 2) { arrivals++; if (arrivals === 2) release(); await barrier; }
            return row;
          };
        } });
      } });
      return work(wrapped);
    }, options),
  };
  const jwt = { signAsync: async ({ sid }) => `signed:${sid}` };
  const auth = new AuthService(proxy, jwt, {}, {});
  const results = await Promise.allSettled([auth.refreshTokens(secret), auth.refreshTokens(secret)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }), 1);
  assert.ok((await prisma.refreshToken.findUnique({ where: { id: session.id } })).revokedAt);
});

test('signing failure rolls back old-token claim and successor row', async () => {
  const { user, secret, session } = await adminSession();
  const auth = new AuthService(prisma, { signAsync: async () => { throw Error('Injected signing failure'); } }, {}, {});
  await assert.rejects(auth.refreshTokens(secret), /Injected signing failure/);
  assert.equal((await prisma.refreshToken.findUnique({ where: { id: session.id } })).revokedAt, null);
  assert.equal(await prisma.refreshToken.count({ where: { userId: user.id } }), 1);
});
