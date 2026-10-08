require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { ValidationPipe } = require('@nestjs/common');
// AuthModule captures this configuration while AppModule is imported. Keep the
// runner's disposable secret when supplied rather than changing it after boot.
process.env.JWT_SECRET ||= 'remediation-disposable-test-secret';
const { AppModule } = require('../src/app.module.ts');
const { PrismaService } = require('../src/prisma/prisma.service.ts');
const { OrderOtpInterceptor } = require('../src/common/order-otp.interceptor.ts');
const { BULK_JSON_LIMIT_BYTES, registerJsonBodyParsers } = require('../src/merchant/bulk-body-parser.ts');

const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/remediation|test/i.test(url.pathname)) {
  throw new Error('upload regression requires a local disposable test database');
}

test('Nest boot resolves auth guard and malformed, oversized, aborted multipart uploads terminate safely', { timeout: 30000 }, async () => {
  process.env.NODE_ENV = 'test';
  process.env.MERCHANT_ACCEPT_TIMEOUT_MINUTES = '0';
  process.env.OTP_PROVIDER = 'mock';
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  registerJsonBodyParsers(app);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
  app.useGlobalInterceptors(new OrderOtpInterceptor());
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer();
  const port = server.address().port;
  const prisma = app.get(PrismaService);
  try {
    const user = await prisma.user.create({ data: { role: 'CUSTOMER', status: 'ACTIVE', phoneNumber: `+94${String(Date.now()).slice(-8)}` } });
    await prisma.customer.create({ data: { userId: user.id } });
    const token = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({ sub: user.id, role: 'CUSTOMER' });
    const base = `http://127.0.0.1:${port}`;
    const unauthenticated = await fetch(`${base}/api/notifications`);
    assert.equal(unauthenticated.status, 401);
    const authenticated = await fetch(`${base}/api/notifications`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(authenticated.status, 200, 'test JWT must authenticate before upload probes');
    const bulkBody = JSON.stringify({ requestId: randomUUID(), mode: 'ADD_MISSING', items: Array.from({ length: 1000 }, (_, index) => ({ rowId: String(index), productId: randomUUID(), name: 'Product from imported CSV', pricePaisa: 10000, stockQuantity: 1 })) });
    assert.ok(Buffer.byteLength(bulkBody) > 100 * 1024, '1000 rows must exceed ordinary JSON limit');
    const acceptedBulkBody = await fetch(`${base}/api/merchant/products/bulk-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: bulkBody, signal: AbortSignal.timeout(8000) });
    assert.equal(acceptedBulkBody.status, 401, `1000-row bulk body should reach auth guard, got ${acceptedBulkBody.status}`);
    const ordinaryOversize = await fetch(`${base}/api/notifications`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: bulkBody, signal: AbortSignal.timeout(8000) });
    assert.equal(ordinaryOversize.status, 413, 'ordinary JSON routes retain the 100 KiB limit');
    const bulkOversize = await fetch(`${base}/api/merchant/products/bulk-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(BULK_JSON_LIMIT_BYTES) }), signal: AbortSignal.timeout(8000) });
    assert.equal(bulkOversize.status, 413, 'bulk JSON routes reject over-limit requests');
    const malformed = await fetch(`${base}/api/uploads/image`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'multipart/form-data; boundary=missing' }, body: 'not-a-multipart-body', signal: AbortSignal.timeout(4000) });
    assert.equal(malformed.status, 400, `malformed upload status ${malformed.status}`);
    const boundary = `remediation-${randomUUID()}`;
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`);
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const oversize = await fetch(`${base}/api/uploads/image`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, body: Buffer.concat([head, Buffer.alloc(6 * 1024 * 1024 + 1), tail]), signal: AbortSignal.timeout(8000) });
    assert.equal(oversize.status, 413, `oversize upload status ${oversize.status}`);
    await new Promise((resolve) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: '/api/uploads/image', method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': 10 * 1024 * 1024 } });
      req.on('error', () => resolve());
      req.on('close', resolve);
      req.write(head);
      req.write(Buffer.alloc(1024));
      setTimeout(() => req.destroy(), 25);
    });
    const afterAbort = await fetch(`${base}/api/notifications`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
    assert.equal(afterAbort.status, 200);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const suspended = await fetch(`${base}/api/notifications`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
    assert.equal(suspended.status, 401);
  } finally {
    await app.close();
  }
});
