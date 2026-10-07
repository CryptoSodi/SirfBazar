import 'reflect-metadata';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { WhatsAppService } from '../src/whatsapp/whatsapp.service';
import { WhatsAppController } from '../src/whatsapp/whatsapp.controller';
import { ROLES_KEY } from '../src/common/decorators';

async function main() {
  const previous = { ...process.env };
  const originalFetch = global.fetch;
  const originalTimeout = AbortSignal.timeout;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let status = 200;
  let payload: any = { status: 'submitted', messageId: 'test-message', requestId: 'test-request' };
  let failure: Error | undefined;
  let pause: Promise<void> | undefined;
  let timeout = 0;
  global.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (pause) await pause;
    if (failure) throw failure;
    return new Response(JSON.stringify(payload), { status });
  };
  AbortSignal.timeout = ((ms: number) => {
    timeout = ms;
    return new AbortController().signal;
  }) as typeof AbortSignal.timeout;
  const rejected = async (action: Promise<unknown>, expected: number, code?: string) => {
    await assert.rejects(action, (error: any) => {
      assert.ok(error instanceof HttpException);
      assert.equal(error.getStatus(), expected);
      const response = JSON.stringify(error.getResponse());
      assert.ok(!response.includes('private-test-value'));
      if (code) assert.equal((error.getResponse() as any).code, code);
      return true;
    });
  };
  try {
    process.env.WHATSAPP_API_BASE_URL = 'http://otp.example.test';
    process.env.WHATSAPP_API_KEY = 'private-test-value';
    const service = new WhatsAppService();
    assert.deepEqual(await service.sendOtp('+923001234567', '001234'), payload);
    assert.equal(calls[0].url, 'http://otp.example.test/send-otp');
    assert.equal(timeout, 30_000);
    assert.equal(calls[0].init?.redirect, 'error');
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: 'Bearer private-test-value', 'Content-Type': 'application/json',
    });
    assert.deepEqual(JSON.parse(calls[0].init?.body as string), { phone: '+923001234567', otp: '001234' });
    for (const otp of ['0000', '0000000000']) await service.sendOtp('+923001234567', otp);
    await service.sendMessage('+442079460123', '😀'.repeat(1000));
    assert.equal(calls.at(-1)?.url, 'http://otp.example.test/send-message');
    assert.equal(JSON.parse(calls.at(-1)?.init?.body as string).phone, '+442079460123');

    const validCalls = calls.length;
    for (const phone of ['03001234567', '+92 3001234567', '+0123456789', 'x', '+1234567890123456']) {
      await rejected(service.sendOtp(phone, '001234'), 400);
    }
    for (const otp of ['123', '12345678901', 'abcd', 123456]) {
      await rejected(service.sendOtp('+923001234567', otp as string), 400);
    }
    for (const message of ['', '  \n ', '😀'.repeat(1001)]) {
      await rejected(service.sendMessage('+923001234567', message), 400);
    }
    assert.equal(calls.length, validCalls, 'invalid input must not call provider');

    for (const [upstream, expected, code] of [
      [400, 400, 'WHATSAPP_INVALID_INPUT'], [401, 503, 'WHATSAPP_CONFIGURATION'],
      [422, 422, 'WHATSAPP_RECIPIENT_UNAVAILABLE'], [429, 429, 'WHATSAPP_BUSY'],
      [503, 503, 'WHATSAPP_UNAVAILABLE'], [502, 502, 'SEND_UNCONFIRMED'],
      [504, 502, 'SEND_UNCONFIRMED'],
    ] as const) {
      status = upstream;
      payload = { message: 'private-test-value', code: upstream === 502 ? 'SEND_UNCONFIRMED' : 'OTHER' };
      const before = calls.length;
      await rejected(service.sendOtp('+923001234567', '001234'), expected, code);
      assert.equal(calls.length, before + 1, 'never retry rejected sends');
    }
    for (const name of ['TimeoutError', 'TypeError']) {
      failure = Object.assign(new Error('private-test-value'), { name });
      const before = calls.length;
      await rejected(service.sendOtp('+923001234567', '001234'), 502, 'SEND_UNCONFIRMED');
      assert.equal(calls.length, before + 1, 'never retry timeout/network failure');
    }
    failure = undefined;
    status = 200;
    payload = { status: 'delivered' };
    await rejected(service.sendOtp('+923001234567', '001234'), 502, 'SEND_UNCONFIRMED');
    payload = { status: 'submitted', messageId: 'test-message', requestId: 'test-request' };
    let release!: () => void;
    pause = new Promise(resolve => { release = resolve; });
    const sending = service.sendOtp('+923001234567', '001234');
    const beforeBusy = calls.length;
    await rejected(service.sendMessage('+923001234567', 'Hello'), 429, 'WHATSAPP_BUSY');
    assert.equal(calls.length, beforeBusy, 'concurrent endpoint must not submit');
    release();
    await sending;
    pause = undefined;

    const limited = new WhatsAppService();
    for (let i = 0; i < 30; i++) {
      if (i % 2) await limited.sendMessage('+923001234567', 'Hello');
      else await limited.sendOtp('+923001234567', '001234');
    }
    const beforeLimit = calls.length;
    await rejected(limited.sendMessage('+923001234567', 'Hello'), 429);
    assert.equal(calls.length, beforeLimit, 'shared limit covers both send endpoints');

    payload = { ready: true };
    assert.deepEqual(await limited.ready(), { ready: true });
    assert.equal(calls.at(-1)?.url, 'http://otp.example.test/ready');
    assert.equal(calls.at(-1)?.init?.method, 'GET');
    status = 503; payload = { ready: false };
    assert.deepEqual(await limited.ready(), { ready: false });
    const controller = new WhatsAppController(limited);
    await rejected(controller.ready(), 503);
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, WhatsAppController), ['ADMIN']);
    status = 401;
    await rejected(limited.ready(), 503, 'WHATSAPP_CONFIGURATION');
    delete process.env.WHATSAPP_API_KEY;
    const beforeConfig = calls.length;
    await rejected(service.sendOtp('+923001234567', '001234'), 503, 'WHATSAPP_CONFIGURATION');
    assert.equal(calls.length, beforeConfig);
    console.log('WhatsApp transport checks passed (mock HTTP only; no messages sent).');
  } finally {
    global.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}

void main().catch(() => { console.error('WhatsApp transport checks failed.'); process.exitCode = 1; });
