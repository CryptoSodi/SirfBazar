import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.REMEDIATION_STAGING_URL ?? '');
if (base.protocol !== 'https:' || !/(staging|test|preview)/i.test(base.hostname) || base.hostname === 'api.sirfbazar.com')
  throw new Error('Staging journey requires a nonproduction HTTPS staging/test/preview API host');
base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
const required = ['REMEDIATION_STAGING_FIXTURE_TOKEN', 'REMEDIATION_STAGING_MERCHANT_TOKEN', 'REMEDIATION_STAGING_RIDER_TOKEN',
  'REMEDIATION_STAGING_ADMIN_TOKEN', 'REMEDIATION_STAGING_CART_ID', 'REMEDIATION_STAGING_ADDRESS_ID'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const request = async (path, token, method = 'GET', body) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(new URL(path.replace(/^\/+/, ''), base), { method, signal: controller.signal,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  } finally { clearTimeout(timeout); }
};

const customer = process.env.REMEDIATION_STAGING_FIXTURE_TOKEN;
const merchant = process.env.REMEDIATION_STAGING_MERCHANT_TOKEN;
const rider = process.env.REMEDIATION_STAGING_RIDER_TOKEN;
const admin = process.env.REMEDIATION_STAGING_ADMIN_TOKEN;
const cartId = process.env.REMEDIATION_STAGING_CART_ID;
const deliveryAddressId = process.env.REMEDIATION_STAGING_ADDRESS_ID;

for (const [label, path, token] of [
  ['public catalogue', '/products/categories', null], ['customer basket', '/cart', customer],
  ['merchant profile', '/merchant/profile', merchant], ['rider profile', '/rider/profile', rider],
  ['admin dashboard', '/admin/dashboard', admin],
]) {
  const result = await request(path, token);
  assert.equal(result.status, 200, `${label} failed (${result.status})`);
  console.log(`PASS ${label}`);
}

const quote = await request('/orders/quote', customer, 'POST', { cartId, deliveryAddressId, paymentMethod: 'COD' });
assert.equal(quote.status, 201, `approved quote failed (${quote.status})`);
assert.equal(quote.data?.version, 1);
assert.ok(quote.data?.approvedQuote && Number.isSafeInteger(quote.data?.quote?.totalAmountPaisa));
console.log('PASS authenticated approved COD quote');

const missingId = randomUUID();
const withoutQuote = await request('/orders', customer, 'POST', { requestId: missingId, cartId, deliveryAddressId, paymentMethod: 'COD' });
assert.equal(withoutQuote.status, 409);
assert.equal(withoutQuote.data?.code, 'QUOTE_REQUIRED');
assert.equal((await request(`/orders/${missingId}`, customer)).status, 404, 'missing-quote rejection created an order');
console.log('PASS missing quote rejected with no order write');

const tamperedId = randomUUID();
const tampered = await request('/orders', customer, 'POST', { requestId: tamperedId, cartId, deliveryAddressId,
  paymentMethod: 'COD', approvedQuote: `${quote.data.approvedQuote}tampered` });
assert.equal(tampered.status, 409);
assert.equal(tampered.data?.code, 'QUOTE_CHANGED');
assert.equal((await request(`/orders/${tamperedId}`, customer)).status, 404, 'tampered-quote rejection created an order');
console.log('PASS tampered quote rejected with no order write');
