import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { WahaOtpService } from '../src/auth/otp/waha-otp.service';

async function main() {
  const observed: Array<{ url?: string; headers: NodeJS.Dict<string | string[]>; body: any }> = [];
  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    observed.push({ url: request.url, headers: request.headers, body: JSON.parse(raw) });
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end('{"id":"test-message"}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const previous = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    process.env.WAHA_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.WAHA_API_KEY = 'a'.repeat(64);
    process.env.WAHA_SESSION = 'default';
    process.env.WAHA_TEST_RECIPIENTS = '+923001234567';

    const service = new WahaOtpService();
    await service.sendOtp('03001234567', '084321', 'MERCHANT_PASSWORD_RESET');
    assert.equal(observed.length, 1);
    assert.equal(observed[0].url, '/api/sendText');
    assert.equal(observed[0].headers['x-api-key'], process.env.WAHA_API_KEY);
    assert.deepEqual(observed[0].body, {
      session: 'default',
      chatId: '923001234567@c.us',
      text: 'Your SirfBazar password reset code is 084321. It expires in 5 minutes. Do not share this code.',
      linkPreview: false,
      linkPreviewHighQuality: false,
    });

    await assert.rejects(
      service.sendOtp('+923009999999', '123456', 'MERCHANT_REGISTRATION'),
      /not configured for this number/,
    );
    assert.equal(observed.length, 1, 'an unlisted number must not reach WAHA');

    process.env.WAHA_BASE_URL = 'https://example.com';
    await assert.rejects(
      service.sendOtp('+923001234567', '123456', 'MERCHANT_REGISTRATION'),
      /not configured for this number/,
    );
    assert.equal(observed.length, 1, 'a remote endpoint must be rejected by default');
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  console.log('WAHA OTP adapter checks passed');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'WAHA OTP adapter check failed');
  process.exitCode = 1;
});
