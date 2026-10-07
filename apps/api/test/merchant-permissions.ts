/** Guarded local checks for merchant staff permissions and application role boundaries. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';

async function response(method: string, path: string, token?: string, body?: unknown) {
  const result = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await result.json().catch(() => null);
  return { status: result.status, data };
}

async function request(method: string, path: string, token?: string, body?: unknown) {
  const result = await response(method, path, token, body);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${method} ${path} returned ${result.status}: ${JSON.stringify(result.data)}`);
  }
  return result.data;
}

async function merchantToken(phoneNumber: string) {
  await request('POST', '/auth/send-otp', undefined, { phoneNumber });
  const session = await request('POST', '/auth/verify-otp', undefined, {
    phoneNumber,
    code: '123456',
    context: 'merchant',
  });
  return session.accessToken as string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const hostname = new URL(API_URL).hostname;
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !['127.0.0.1', 'localhost'].includes(hostname)) {
    throw new Error('This permission suite is restricted to an explicitly confirmed local API.');
  }

  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME },
    include: { user: { select: { id: true, phoneNumber: true } } },
  });
  assert(merchant, `Merchant '${SHOP_NAME}' was not found.`);

  const ownerPhone = merchant.user.phoneNumber || '+923019999904';
  if (!merchant.user.phoneNumber) {
    await prisma.user.update({
      where: { id: merchant.user.id },
      data: { phoneNumber: ownerPhone, isPhoneVerified: true },
    });
  }
  const ownerToken = await merchantToken(ownerPhone);

  const suffix = Date.now().toString().slice(-7);
  const staffPhone = `+92306${suffix}`;
  const staff = await request('POST', '/merchant/staff', ownerToken, {
    fullName: `QA Orders Staff ${suffix}`,
    phoneNumber: staffPhone,
    roleName: 'Orders only',
    permissions: ['ORDERS'],
  });
  const staffToken = await merchantToken(staffPhone);

  const anonymousProfile = await response('GET', '/merchant/profile');
  assert(anonymousProfile.status === 401, `Anonymous merchant profile returned ${anonymousProfile.status}, expected 401.`);

  const allowedOrders = await response('GET', '/merchant/orders', staffToken);
  assert(allowedOrders.status === 200, `Orders-only staff list returned ${allowedOrders.status}, expected 200.`);

  const forbiddenChecks: Array<[string, string, number[]]> = [
    ['/merchant/products', 'inventory', [403]],
    ['/merchant/earnings', 'finance', [403]],
    ['/merchant/riders', 'riders', [403]],
    ['/merchant/staff', 'owner-only staff management', [400, 403]],
    ['/admin/dashboard', 'admin', [403]],
    ['/orders', 'customer orders', [403]],
    ['/payments/order/not-a-real-order', 'customer payments', [403]],
  ];

  for (const [path, label, expected] of forbiddenChecks) {
    const result = await response('GET', path, staffToken);
    assert(expected.includes(result.status), `${label} boundary returned ${result.status}, expected ${expected.join(' or ')}.`);
  }

  const ownerProfile = await response('GET', '/merchant/profile', ownerToken);
  assert(ownerProfile.status === 200, `Owner profile returned ${ownerProfile.status}, expected 200.`);

  console.log(
    `PASS staff ${staff.id}: ORDERS allowed; inventory, finance, riders, owner, admin, customer and payment boundaries denied.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
