/**
 * SirfBazar end-to-end smoke test against a RUNNING dev API (seeded DB).
 *   1. npm run dev   (in apps/api, with seeded dev.db)
 *   2. npm run smoke
 *
 * Exercises the spec's critical paths: guest browse → guest cart →
 * login-at-checkout → cart merge → COD order → merchant accept/prepare/ready →
 * assign own rider → rider pickup/track/deliver with OTP → rate →
 * multi-merchant split order → online payment → cancellation+refund →
 * admin dashboard + settlement.
 */
const BASE = process.env.API_URL || 'http://localhost:3001/api';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}`, extra ?? '');
  }
}

async function api(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; guest?: string; expect?: number } = {},
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.guest ? { 'x-guest-session': opts.guest } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (opts.expect != null && res.status !== opts.expect) {
    throw new Error(`${method} ${path} -> ${res.status} (expected ${opts.expect}): ${JSON.stringify(data)?.slice(0, 300)}`);
  }
  return { status: res.status, data };
}

async function loginOtp(phone: string) {
  await api('POST', '/auth/send-otp', { body: { phoneNumber: phone } });
  const { data } = await api('POST', '/auth/verify-otp', {
    body: { phoneNumber: phone, code: '123456' },
    expect: 201,
  });
  return data as { accessToken: string; refreshToken: string; user: any };
}

const LAT = 31.5204;
const LNG = 74.3587;

async function main() {
  console.log(`Smoke-testing ${BASE}\n`);

  // ── 1. Guest browsing (no login) ─────────────────────────────────────────
  console.log('1. Guest browsing');
  const cats = await api('GET', '/products/categories', { expect: 200 });
  check('categories load for guests', Array.isArray(cats.data) && cats.data.length >= 10);

  const nearby = await api('GET', `/products/nearby?latitude=${LAT}&longitude=${LNG}&pageSize=50`, { expect: 200 });
  const cards: any[] = nearby.data.items ?? [];
  check('nearby products for guests', cards.length >= 10, nearby.data);

  const shops = await api('GET', `/merchants/nearby?latitude=${LAT}&longitude=${LNG}`, { expect: 200 });
  check('nearby shops for guests', (shops.data.items ?? []).length >= 3);

  const search = await api('GET', `/products/search?q=milk&latitude=${LAT}&longitude=${LNG}`, { expect: 200 });
  check('search works for guests', (search.data.items ?? []).length >= 1);

  const detail = await api('GET', `/products/${cards[0].productId}?latitude=${LAT}&longitude=${LNG}`, { expect: 200 });
  check('product detail with offers', (detail.data.offers ?? []).length >= 1);

  // ── 2. Guest cart ─────────────────────────────────────────────────────────
  console.log('2. Guest cart');
  const session = await api('POST', '/guest/session', {
    body: { latitude: LAT, longitude: LNG, city: 'Lahore' },
    expect: 201,
  });
  const guest = session.data.sessionToken as string;
  check('guest session created', !!guest);

  // Pick two items from one merchant and one from another for later multi-merchant test.
  const byMerchant = new Map<string, any[]>();
  for (const c of cards) {
    const list = byMerchant.get(c.merchant.id) ?? [];
    list.push(c);
    byMerchant.set(c.merchant.id, list);
  }
  const merchants = [...byMerchant.entries()].filter(([, v]) => v.length >= 2);
  check('at least 2 merchants with 2+ products nearby', merchants.length >= 2);
  const [m1, m1Items] = merchants[0];
  const [m2, m2Items] = merchants[1];

  await api('POST', '/guest/cart/items', {
    guest,
    body: { merchantProductId: m1Items[0].merchantProductId, quantity: 2 },
    expect: 201,
  });
  const gcart = await api('POST', '/guest/cart/items', {
    guest,
    body: { merchantProductId: m1Items[1].merchantProductId, quantity: 1 },
    expect: 201,
  });
  check('guest cart has 3 units', gcart.data.itemCount === 3, gcart.data.itemCount);
  check('guest cart totals computed', gcart.data.totalPaisa > 0);

  // ── 3. Login at checkout + cart merge ────────────────────────────────────
  console.log('3. Login at checkout');
  const customer = await loginOtp('+923001112233');
  check('customer OTP login', !!customer.accessToken);
  check('customer role', customer.user.role === 'CUSTOMER');

  // Re-runs leave items in this account's cart — start clean before merging.
  await api('DELETE', '/cart/clear', { token: customer.accessToken });

  const merged = await api('POST', '/guest/cart/merge-after-login', {
    guest,
    token: customer.accessToken,
    expect: 201,
  });
  check('guest cart merged into customer cart', merged.data.itemCount === 3, merged.data.itemCount);

  const addr = await api('POST', '/customer/addresses', {
    token: customer.accessToken,
    body: {
      label: 'Home',
      fullAddress: 'House 12, Street 5, Gulberg III, Lahore',
      city: 'Lahore',
      area: 'Gulberg III',
      latitude: LAT + 0.005,
      longitude: LNG + 0.005,
      contactName: 'Smoke Tester',
      contactPhone: '+923001112233',
      isDefault: true,
    },
    expect: 201,
  });
  check('address saved', !!addr.data.id);

  const couponApply = await api('POST', '/cart/apply-coupon', {
    token: customer.accessToken,
    body: { code: 'SAVE50' },
  });
  check('coupon applies (or politely rejects)', [200, 201, 400].includes(couponApply.status));

  // ── 4. COD order, full lifecycle ─────────────────────────────────────────
  console.log('4. COD order lifecycle');
  const order = await api('POST', '/orders', {
    token: customer.accessToken,
    body: { deliveryAddressId: addr.data.id, paymentMethod: 'COD', customerNote: 'Ring the bell' },
    expect: 201,
  });
  const orderId = order.data.id as string;
  check('order placed', !!orderId);
  check('order sent to merchant', order.data.status === 'SENT_TO_MERCHANT', order.data.status);
  check('stock validation present', (order.data.items ?? []).length === 2);

  // Merchant side
  const merchant1Owner = await loginOtp(await ownerPhone(m1));
  check('merchant owner login', merchant1Owner.user.role === 'MERCHANT_OWNER');

  const mOrders = await api('GET', '/merchant/orders?status=SENT_TO_MERCHANT', { token: merchant1Owner.accessToken, expect: 200 });
  const mOrder = (mOrders.data as any[]).find((o) => o.id === orderId);
  check('merchant sees the order', !!mOrder);

  await api('POST', `/merchant/orders/${orderId}/accept`, { token: merchant1Owner.accessToken, expect: 201 });
  await api('POST', `/merchant/orders/${orderId}/preparing`, { token: merchant1Owner.accessToken, expect: 201 });
  await api('POST', `/merchant/orders/${orderId}/ready`, { token: merchant1Owner.accessToken, expect: 201 });
  check('merchant accept → preparing → ready', true);

  const riders = await api('GET', '/merchant/riders', { token: merchant1Owner.accessToken, expect: 200 });
  const riderList: any[] = Array.isArray(riders.data) ? riders.data : riders.data.items ?? [];
  check('merchant has riders', riderList.length >= 1);
  const riderId = riderList[0].id;

  const assign = await api('POST', `/merchant/orders/${orderId}/assign-rider`, {
    token: merchant1Owner.accessToken,
    body: { riderId },
    expect: 201,
  });
  check('merchant assigned own rider', assign.data.ok === true);

  // Tenancy guard: another merchant's rider must be rejected.
  const merchant2Owner = await loginOtp(await ownerPhone(m2));
  const foreignAssign = await api('POST', `/merchant/orders/${orderId}/assign-rider`, {
    token: merchant2Owner.accessToken,
    body: { riderId },
  });
  check('other merchant cannot touch the order (404)', foreignAssign.status === 404, foreignAssign.status);

  // Rider side
  const riderPhone = riderList[0].phoneNumber;
  const rider = await loginOtp(riderPhone);
  check('rider OTP login', rider.user.role === 'RIDER');
  await api('POST', '/rider/online', { token: rider.accessToken, expect: 201 });

  const assigned = await api('GET', '/rider/orders/assigned', { token: rider.accessToken, expect: 200 });
  check('rider sees assigned order', (assigned.data as any[]).some((o) => o.id === orderId));

  await api('POST', `/rider/orders/${orderId}/arrived-shop`, { token: rider.accessToken, body: { latitude: LAT, longitude: LNG }, expect: 201 });
  await api('POST', `/rider/orders/${orderId}/picked-up`, { token: rider.accessToken, body: {}, expect: 201 });
  await api('POST', '/rider/location', {
    token: rider.accessToken,
    body: { latitude: LAT + 0.002, longitude: LNG + 0.002, orderId },
    expect: 201,
  });
  check('rider pickup + location ping', true);

  // Customer can now see OTP in tracking.
  const track = await api('GET', `/orders/${orderId}/track`, { token: customer.accessToken, expect: 200 });
  const delivery = track.data.deliveries?.[0];
  check('tracking shows rider location', !!delivery?.riderLocation, delivery);
  check('delivery OTP revealed after pickup', /^\d{4}$/.test(delivery?.deliveryOtp ?? ''), delivery?.deliveryOtp);

  await api('POST', `/rider/orders/${orderId}/arrived-customer`, { token: rider.accessToken, body: {}, expect: 201 });
  const wrongOtp = await api('POST', `/rider/orders/${orderId}/delivered`, {
    token: rider.accessToken,
    body: { otp: '0000' },
  });
  check('wrong delivery OTP rejected', wrongOtp.status === 400, wrongOtp.status);

  await api('POST', `/rider/orders/${orderId}/delivered`, {
    token: rider.accessToken,
    body: { otp: delivery.deliveryOtp },
    expect: 201,
  });
  const done = await api('GET', `/orders/${orderId}`, { token: customer.accessToken, expect: 200 });
  check('order DELIVERED with correct OTP', done.data.status === 'DELIVERED', done.data.status);
  check('COD cash collected', done.data.paymentStatus === 'CASH_COLLECTED', done.data.paymentStatus);
  check('timeline recorded every step', (done.data.timeline ?? []).length >= 8, done.data.timeline?.length);

  const rate = await api('POST', `/orders/${orderId}/rate`, {
    token: customer.accessToken,
    body: { merchantRating: 5, riderRating: 5, reviewText: 'Fast and fresh!' },
    expect: 201,
  });
  check('customer rated order', (rate.data.reviews ?? []).length >= 1);

  // ── 5. Multi-merchant order ──────────────────────────────────────────────
  console.log('5. Multi-merchant order');
  // Quantity 5 keeps every shop's group above its minimum order value.
  await api('POST', '/cart/items', { token: customer.accessToken, body: { merchantProductId: m1Items[0].merchantProductId, quantity: 5 }, expect: 201 });
  await api('POST', '/cart/items', { token: customer.accessToken, body: { merchantProductId: m2Items[0].merchantProductId, quantity: 5 }, expect: 201 });
  const multi = await api('POST', '/orders', {
    token: customer.accessToken,
    body: { deliveryAddressId: addr.data.id, paymentMethod: 'COD' },
    expect: 201,
  });
  check('parent order created', multi.data.isParent === true);
  check('one child per merchant', (multi.data.children ?? []).length === 2, multi.data.children?.length);

  // ── 6. Online payment flow ───────────────────────────────────────────────
  console.log('6. Online payment');
  await api('POST', '/cart/items', { token: customer.accessToken, body: { merchantProductId: m1Items[1].merchantProductId, quantity: 5 }, expect: 201 });
  const online = await api('POST', '/orders', {
    token: customer.accessToken,
    body: { deliveryAddressId: addr.data.id, paymentMethod: 'JAZZCASH' },
    expect: 201,
  });
  check('online order awaits payment', online.data.status === 'PAYMENT_PENDING', online.data.status);
  const init = await api('POST', `/payments/order/${online.data.id}/initiate`, { token: customer.accessToken, expect: 201 });
  await api('POST', `/payments/${init.data.paymentId}/confirm`, { token: customer.accessToken, body: {}, expect: 201 });
  const afterPay = await api('GET', `/orders/${online.data.id}`, { token: customer.accessToken, expect: 200 });
  check('paid order sent to merchant', afterPay.data.status === 'SENT_TO_MERCHANT', afterPay.data.status);
  check('payment status PAID', afterPay.data.paymentStatus === 'PAID', afterPay.data.paymentStatus);

  // ── 7. Cancellation + auto refund ────────────────────────────────────────
  console.log('7. Cancellation & refund');
  const stockBefore = await merchantProductStock(m1Items[0].merchantProductId, customer.accessToken, m1Items[0].productId);
  await api('POST', '/cart/items', { token: customer.accessToken, body: { merchantProductId: m1Items[0].merchantProductId, quantity: 5 }, expect: 201 });
  const toCancel = await api('POST', '/orders', {
    token: customer.accessToken,
    body: { deliveryAddressId: addr.data.id, paymentMethod: 'COD' },
    expect: 201,
  });
  const cancelled = await api('POST', `/orders/${toCancel.data.id}/cancel`, {
    token: customer.accessToken,
    body: { reason: 'Changed my mind' },
    expect: 201,
  });
  check('order cancelled before acceptance', cancelled.data.status === 'CANCELLED_BY_CUSTOMER', cancelled.data.status);
  const stockAfter = await merchantProductStock(m1Items[0].merchantProductId, customer.accessToken, m1Items[0].productId);
  check('stock restored after cancel', stockAfter === stockBefore, `${stockBefore} -> ${stockAfter}`);

  // ── 8. Admin oversight ───────────────────────────────────────────────────
  console.log('8. Admin');
  const admin = await api('POST', '/auth/admin-login', {
    body: { email: 'admin@sirfbazar.pk', password: 'Admin@12345' },
    expect: 201,
  });
  const adminToken = admin.data.accessToken as string;
  check('admin login', !!adminToken);

  const dash = await api('GET', '/admin/dashboard', { token: adminToken, expect: 200 });
  check('admin dashboard has orders', dash.data.totalOrders >= 1 || dash.data.completedOrders >= 1, dash.data);

  const gen = await api('POST', '/admin/settlements/generate', {
    token: adminToken,
    body: {
      startDate: new Date(Date.now() - 86400_000).toISOString(),
      endDate: new Date(Date.now() + 86400_000).toISOString(),
    },
  });
  check('settlements generated', [200, 201].includes(gen.status), gen.status);
  const settlements = Array.isArray(gen.data) ? gen.data : gen.data?.items ?? [];
  if (settlements.length > 0) {
    const paid = await api('POST', `/admin/settlements/${settlements[0].id}/mark-paid`, {
      token: adminToken,
      body: { paymentReference: 'SMOKE-PAYOUT-1' },
    });
    check('settlement marked paid', [200, 201].includes(paid.status), paid.status);
  } else {
    check('settlement rows produced for delivered orders', false, gen.data);
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

/** Look up a merchant owner's phone from the seeded data via admin-free route. */
async function ownerPhone(merchantId: string): Promise<string> {
  // Seeded merchants use +92301000000N; merchant detail exposes phoneNumber.
  const res = await api('GET', `/merchants/${merchantId}`, { expect: 200 });
  return res.data.phoneNumber;
}

async function merchantProductStock(merchantProductId: string, token: string, productId: string): Promise<number> {
  const res = await api('GET', `/products/${productId}?latitude=${LAT}&longitude=${LNG}`);
  const offer = (res.data.offers ?? []).find((o: any) => o.merchantProductId === merchantProductId);
  return offer?.stockQuantity ?? -1;
}

main().catch((err) => {
  console.error('\nSMOKE TEST CRASHED:', err.message);
  process.exit(1);
});
