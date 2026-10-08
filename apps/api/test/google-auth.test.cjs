const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { GoogleIdTokenService, MockGoogleAuthService, createGoogleAuthService } = require('../src/auth/google/google-auth.service');
const { AuthService } = require('../src/auth/auth.service');
const { Prisma } = require('@prisma/client');
const { AuthController } = require('../src/auth/auth.controller');
const { IS_PUBLIC_KEY } = require('../src/common/decorators');
const { UnauthorizedException, ServiceUnavailableException } = require('@nestjs/common');

const audience = '123-test.apps.googleusercontent.com';
test('Google login is public but Google linking requires the existing JWT guard', () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.googleLogin), true);
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.googleLink), true);
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController), true);
});
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const cert = keys.publicKey.export({ type: 'spki', format: 'pem' });
const claims = () => ({ sub: 'google-subject', email: 'owner@gmail.com', email_verified: true,
  aud: audience, iss: 'https://accounts.google.com', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
function token(overrides = {}, signingKey = keys.privateKey) {
  const body = [Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url'),
    Buffer.from(JSON.stringify({ ...claims(), ...overrides })).toString('base64url')].join('.');
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), signingKey).toString('base64url')}`;
}
function verifier() {
  const requests = [];
  const client = new OAuth2Client({ transporterOptions: { adapter: async options => {
    requests.push(options);
    return { config: options, data: { 'test-key': cert }, status: 200, statusText: 'OK', headers: new Headers({ 'cache-control': 'public, max-age=3600' }) };
  } } });
  return { service: new GoogleIdTokenService(audience, client), requests, client };
}

test('SDK verifies a real signature and caches public certificates with a bounded request', async () => {
  const { service, requests } = verifier();
  const profile = await service.verifyIdToken(token());
  assert.equal(profile.googleId, claims().sub);
  assert.equal(profile.emailAuthoritative, true);
  await service.verifyIdToken(token());
  assert.equal(requests.length, 1);
  assert.equal(requests[0].timeout, 5000);
  assert.equal(requests[0].retry, false);
  assert.ok(!String(requests[0].url).includes('id_token'));
});

for (const [name, overrides] of Object.entries({
  'wrong audience': { aud: 'other.apps.googleusercontent.com' },
  'wrong issuer': { iss: 'https://attacker.example' },
  'expired token': { exp: Math.floor(Date.now() / 1000) - 600 },
  'future issue time': { iat: Math.floor(Date.now() / 1000) + 1000 },
  'unverified email': { email_verified: false },
  'string email verification': { email_verified: 'true' },
  'missing subject': { sub: '' },
  'missing email': { email: '' },
})) test(`rejects ${name}`, async () => {
  await assert.rejects(verifier().service.verifyIdToken(token(overrides)), e => e.getStatus() === 401);
});

test('rejects forged signatures, mock tokens and oversized input', async () => {
  const foreign = generateKeyPairSync('rsa', { modulusLength: 2048 });
  for (const value of [token({}, foreign.privateKey), 'mock:admin@gmail.com', 'x'.repeat(10001)]) {
    await assert.rejects(verifier().service.verifyIdToken(value), e => e.getStatus() === 401 && !e.message.includes(value));
  }
});
test('Google authority is distinct from email_verified for third-party email', async () => {
  assert.equal((await verifier().service.verifyIdToken(token({ email: 'person@example.com' }))).emailAuthoritative, false);
  assert.equal((await verifier().service.verifyIdToken(token({ email: 'person@example.com', hd: 'example.com' }))).emailAuthoritative, true);
});
test('certificate outages return a retryable 503 without disclosing SDK diagnostics', async () => {
  const { service, client } = verifier();
  client.getFederatedSignonCertsAsync = async () => { throw new Error('Failed to retrieve verification certificates: network detail'); };
  await assert.rejects(service.verifyIdToken(token()), e => e.getStatus() === 503 && !e.message.includes('network detail'));
});
test('production cannot select mocks, unknown providers or an empty audience', async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, GOOGLE_AUTH_PROVIDER: process.env.GOOGLE_AUTH_PROVIDER, GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID };
  try {
    process.env.NODE_ENV = 'production';
    for (const provider of ['mock', 'typo']) {
      process.env.GOOGLE_AUTH_PROVIDER = provider;
      assert.throws(createGoogleAuthService);
    }
    process.env.GOOGLE_AUTH_PROVIDER = 'google';
    process.env.GOOGLE_CLIENT_ID = '';
    assert.throws(createGoogleAuthService);
    await assert.rejects(new MockGoogleAuthService().verifyIdToken('mock:owner@gmail.com'));
    process.env.GOOGLE_CLIENT_ID = audience;
    assert.ok(createGoogleAuthService() instanceof GoogleIdTokenService);
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_AUTH_PROVIDER = 'mock';
    assert.ok(createGoogleAuthService() instanceof MockGoogleAuthService);
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

function fixture(options = {}) {
  const users = (options.users || []).map(u => ({ status: 'ACTIVE', role: 'CUSTOMER', googleId: null, email: 'owner@gmail.com', ...u }));
  const changes = [], issued = [], locks = [];
  const db = {
    $executeRaw: async (_sql, key) => { locks.push(key); },
    user: {
      findUnique: async ({ where }) => users.find(u => Object.entries(where).every(([key, value]) => u[key] === value)) || null,
      findMany: async ({ where }) => users.filter(u => u.email?.toLowerCase() === where.email.equals.toLowerCase()),
      create: async ({ data }) => {
        if (options.uniqueFailure) throw new Prisma.PrismaClientKnownRequestError('collision', { code: 'P2002', clientVersion: 'test' });
        const user = { id: 'new-user', status: 'ACTIVE', ...data }; users.push(user); changes.push(data); return user;
      },
      updateMany: async ({ where, data }) => {
        if (options.updateLost) return { count: 0 };
        const user = users.find(u => u.id === where.id && u.status === where.status &&
          (where.OR ? where.OR.some(condition => condition.googleId === u.googleId) : where.googleId === u.googleId));
        if (!user) return { count: 0 };
        Object.assign(user, data); changes.push(data); return { count: 1 };
      },
    },
    customer: { upsert: async () => ({}) },
    merchant: { findUnique: async () => options.owner ? { id: 'shop' } : null },
    merchantStaff: { findFirst: async ({ where }) => options.staff && where.status === 'ACTIVE' ? { id: 'staff' } : null },
    rider: { findUnique: async () => options.rider ? { id: 'rider' } : null },
  };
  db.$transaction = async callback => callback(db);
  const service = new AuthService(db, {}, {}, { verifyIdToken: async () => ({ googleId: 'google-subject', email: 'owner@gmail.com', emailAuthoritative: true, ...options.profile }) });
  service.issueTokens = async (id, role) => { issued.push({ id, role }); return { id, role }; };
  return { service, users, changes, issued, locks };
}
for (const [context, expected, options] of [
  ['customer', 'CUSTOMER', {}], ['merchant', 'MERCHANT_OWNER', { owner: true }],
  ['merchant', 'MERCHANT_STAFF', { staff: true }], ['rider', 'RIDER', { rider: true }],
  ['rider', 'CUSTOMER', {}], ['admin', 'ADMIN', { users: [{ id: 'owner', role: 'ADMIN' }] }],
]) test(`existing Google identity gets only the authorized ${context}/${expected} role`, async () => {
  const f = fixture({ users: [{ id: 'owner' }], ...options });
  assert.equal((await f.service.googleLogin('token', context)).role, expected);
  assert.deepEqual(f.changes, [{ googleId: 'google-subject', isEmailVerified: true }]);
  assert.equal(f.locks.length, 2);
});
test('customer self-registration creates one customer identity and a repeat login reuses its subject', async () => {
  const f = fixture();
  await f.service.googleLogin('token');
  await f.service.googleLogin('token');
  assert.equal(f.users.length, 1);
  assert.equal(f.changes.length, 1);
  assert.equal(f.users[0].role, 'CUSTOMER');
});
for (const context of ['merchant', 'admin', 'rider']) test(`new ${context} login cannot silently self-register`, async () => {
  const f = fixture();
  await assert.rejects(f.service.googleLogin('token', context), e => e.getStatus() === 401);
  assert.equal(f.changes.length, 0);
  assert.equal(f.issued.length, 0);
});
for (const options of [
  { users: [{ id: 'owner', googleId: 'other-subject' }] },
  { users: [{ id: 'owner' }], profile: { emailAuthoritative: false } },
  { users: [{ id: 'owner', status: 'SUSPENDED' }] },
  { users: [{ id: 'owner', status: 'DELETED', googleId: 'google-subject' }] },
  { users: [{ id: 'owner' }], updateLost: true },
  { users: [{ id: 'one' }, { id: 'two', email: 'OWNER@gmail.com' }] },
  { uniqueFailure: true },
]) test(`rejects unsafe linking or inactive identity: ${JSON.stringify(options)}`, async () => {
  const f = fixture(options);
  await assert.rejects(f.service.googleLogin('token'), e => e.getStatus() === 401);
  assert.equal(f.changes.length, 0);
  assert.equal(f.issued.length, 0);
});
test('denied admin and merchant access does not link Google', async () => {
  for (const context of ['admin', 'merchant']) {
    const f = fixture({ users: [{ id: 'customer' }] });
    await assert.rejects(f.service.googleLogin('token', context));
    assert.equal(f.changes.length, 0);
  }
});
test('authenticated linking preserves phone, email and role and is idempotent', async () => {
  const f = fixture({ users: [{ id: 'phone-user', email: null, phoneNumber: '+923001234567' }] });
  await f.service.linkGoogle('phone-user', 'token');
  await f.service.linkGoogle('phone-user', 'token');
  assert.equal(f.users[0].email, null);
  assert.equal(f.users[0].phoneNumber, '+923001234567');
  assert.equal(f.users[0].role, 'CUSTOMER');
  assert.equal(f.issued.length, 0);
});
test('authenticated linking cannot steal, replace or link to an inactive account', async () => {
  for (const users of [
    [{ id: 'me' }, { id: 'other', googleId: 'google-subject' }],
    [{ id: 'me', googleId: 'different' }], [{ id: 'me', status: 'SUSPENDED' }], [],
    [{ id: 'me', email: null }, { id: 'other', email: 'OWNER@gmail.com' }],
  ]) {
    const f = fixture({ users });
    await assert.rejects(f.service.linkGoogle('me', 'token'));
    assert.equal(f.changes.length, 0);
  }
});

test('invalid Google proof while linking does not invalidate a valid app session', async () => {
  for (const [error, status] of [[new UnauthorizedException('Invalid Google token'), 400], [new ServiceUnavailableException('Temporary failure'), 503]]) {
    const service = new AuthService({}, {}, {}, { verifyIdToken: async () => { throw error; } });
    await assert.rejects(service.linkGoogle('me', 'bad-token'), e => e.getStatus() === status);
  }
});
