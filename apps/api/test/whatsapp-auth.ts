import 'reflect-metadata';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { WhatsAppError } from '../src/whatsapp/whatsapp.service';
import { AuthModule } from '../src/auth/auth.module';
import { OTP_SERVICE } from '../src/auth/otp/otp.interface';

// In-memory database double: no production data, credentials, or outbound messages.
function fixture() {
  const rows: any[] = [];
  const sent: Array<{ phone: string; code: string; purpose: string }> = [];
  let deliveryError: Error | undefined;
  let lockTail = Promise.resolve();
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]: any) => {
    if (value && typeof value === 'object') {
      if (value.gt !== undefined) return row[key] > value.gt;
      if (value.gte !== undefined) return row[key] >= value.gte;
      if (value.lt !== undefined) return row[key] < value.lt;
    }
    return row[key] === value;
  });
  const user = { id: 'test-user', isPhoneVerified: true, status: 'ACTIVE', staffOf: [], merchant: null };
  const db: any = {
    $executeRaw: async () => 1,
    otpCode: {
      findFirst: async ({ where }: any) => rows.filter(row => matches(row, where)).sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null,
      findUnique: async ({ where }: any) => rows.find(row => row.id === where.id) ?? null,
      count: async ({ where }: any) => rows.filter(row => matches(row, where)).length,
      create: async ({ data }: any) => {
        const row = { ...data, id: String(rows.length + 1), createdAt: new Date(), consumedAt: null, attempts: 0 };
        rows.push(row); return row;
      },
      update: async ({ where, data }: any) => Object.assign(rows.find(row => row.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        const selected = rows.filter(row => matches(row, where));
        for (const row of selected) {
          for (const [key, value] of Object.entries(data) as any) {
            row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
          }
        }
        return { count: selected.length };
      },
    },
    user: { findFirst: async () => user, findUnique: async () => user, update: async () => user },
    customer: { upsert: async () => ({}) },
    refreshToken: { updateMany: async () => ({ count: 0 }) },
    $transaction: async (action: any) => {
      if (Array.isArray(action)) return Promise.all(action);
      const prior = lockTail;
      let release!: () => void;
      lockTail = new Promise(resolve => { release = resolve; });
      await prior;
      try { return await action(db); } finally { release(); }
    },
  };
  const service = new AuthService(db, {} as any, {
    sendOtp: async (phone, code, purpose) => {
      sent.push({ phone, code, purpose });
      if (deliveryError) throw deliveryError;
    },
  }, {} as any);
  service.issueTokens = async () => ({ accessToken: 'test-token' } as any);
  return { rows, sent, service, fail: (error: Error) => { deliveryError = error; } };
}

async function main() {
  const previous = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'production', OTP_PROVIDER: 'whatsapp', OTP_TTL_SECONDS: '300',
    OTP_MAX_ATTEMPTS: '5', OTP_RESEND_COOLDOWN_SECONDS: '60', OTP_MAX_REQUESTS_PER_HOUR: '5' });
  try {
    const factory = Reflect.getMetadata('providers', AuthModule).find((provider: any) => provider.provide === OTP_SERVICE).useFactory;
    const transport = {};
    assert.equal(factory(transport), transport);
    process.env.OTP_PROVIDER = 'mock';
    assert.throws(() => factory(transport), /disabled in production/);
    delete process.env.OTP_PROVIDER;
    assert.equal(factory(transport), transport, 'production must never default to mock');
    process.env.OTP_PROVIDER = 'whatsapp';
    const login = fixture();
    const result = await login.service.sendOtp('03001234567');
    assert.equal(result.status, 'submitted');
    assert.equal(login.sent[0].phone, '+923001234567');
    assert.match(login.sent[0].code, /^\d{6}$/);
    assert.notEqual(login.rows[0].codeHash, login.sent[0].code);
    assert.ok(await bcrypt.compare(login.sent[0].code, login.rows[0].codeHash));
    assert.ok(login.rows[0].expiresAt.getTime() - Date.now() <= 300_000);
    await assert.rejects(login.service.sendOtp('+923001234567'), (e: any) => e.getStatus() === 429);
    assert.equal(login.sent.length, 1);
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => login.service.verifyOtp('+923001234567', 'not-a-code')));
    assert.ok(attempts.every(item => item.status === 'rejected'));
    assert.equal(login.rows[0].attempts, 5, 'concurrent wrong attempts stay capped');
    await assert.rejects(login.service.verifyOtp('+923001234567', login.sent[0].code));

    const replay = fixture();
    await replay.service.sendOtp('+923001234567');
    const both = await Promise.allSettled([
      replay.service.verifyOtp('+923001234567', replay.sent[0].code),
      replay.service.verifyOtp('+923001234567', replay.sent[0].code),
    ]);
    assert.equal(both.filter(item => item.status === 'fulfilled').length, 1, 'single-use even concurrently');
    await assert.rejects(replay.service.verifyOtp('+923001234567', replay.sent[0].code));

    const concurrent = fixture();
    const sends = await Promise.allSettled([concurrent.service.sendOtp('+923001234567'), concurrent.service.sendOtp('03001234567')]);
    assert.equal(sends.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(concurrent.sent.length, 1);
    concurrent.rows[0].codeHash = await bcrypt.hash('000123', 12);
    await assert.rejects(concurrent.service.verifyOtp('+923001234567', '123456'), 'no production master code');
    concurrent.rows[0].expiresAt = new Date(0);
    await assert.rejects(concurrent.service.verifyOtp('+923001234567', concurrent.sent[0].code));

    const uncertain = fixture();
    uncertain.fail(new WhatsAppError('SEND_UNCONFIRMED', 'Unconfirmed', 502, true));
    assert.equal((await uncertain.service.sendOtp('+923001234567')).status, 'unconfirmed');
    assert.equal(uncertain.rows[0].consumedAt, null);
    await assert.rejects(uncertain.service.sendOtp('+923001234567'), (e: any) => e.getStatus() === 429);
    await uncertain.service.verifyOtp('+923001234567', uncertain.sent[0].code);
    assert.equal(uncertain.sent.length, 1);

    const rejected = fixture();
    rejected.fail(new WhatsAppError('WHATSAPP_RECIPIENT_UNAVAILABLE', 'Unavailable', 422));
    await assert.rejects(rejected.service.sendOtp('+923001234567'));
    assert.ok(rejected.rows[0].consumedAt);

    const resend = fixture();
    await resend.service.sendOtp('+923001234567');
    resend.rows[0].createdAt = new Date(Date.now() - 61_000);
    await resend.service.sendOtp('+923001234567');
    assert.ok(resend.rows[0].consumedAt, 'resend invalidates the previous challenge');
    assert.equal(resend.rows[1].consumedAt, null);

    const register = fixture();
    const registration = await register.service.startMerchantRegistration({
      firstName: 'Test', lastName: 'Only', channel: 'mobile', contact: '03001234567',
      cnic: '0000000000000', password: 'test-only-password',
    });
    assert.equal(registration.status, 'submitted');
    assert.equal(register.sent[0].purpose, 'MERCHANT_REGISTRATION');
    await register.service.verifyMerchantRegistration(registration.attemptId, register.sent[0].code);
    await assert.rejects(register.service.verifyMerchantRegistration(registration.attemptId, register.sent[0].code));
    await assert.rejects(register.service.requestMerchantPasswordReset('test@example.com'), (e: any) => e.getStatus() === 400);

    const reset = fixture();
    await reset.service.requestMerchantPasswordReset('+923001234567');
    assert.equal(reset.sent[0].purpose, 'MERCHANT_PASSWORD_RESET');
    assert.deepEqual(await reset.service.resetMerchantPassword('+923001234567', reset.sent[0].code, 'test-only-password'), { reset: true });
    await assert.rejects(reset.service.resetMerchantPassword('+923001234567', reset.sent[0].code, 'test-only-password'));

    const hourly = fixture();
    for (let i = 0; i < 5; i++) hourly.rows.push({ phoneNumber: '+923001234567', createdAt: new Date(Date.now() - 120_000), purpose: 'LOGIN' });
    await assert.rejects(hourly.service.sendOtp('+923001234567'), (e: any) => e.getStatus() === 429);
    assert.equal(hourly.sent.length, 0);
    console.log('WhatsApp authentication checks passed (in-memory database; no messages sent).');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}

void main().catch(error => { console.error(error instanceof Error ? error.message : 'Authentication checks failed'); process.exitCode = 1; });
