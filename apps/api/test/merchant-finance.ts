/** Guarded local check for populated earnings and read-only settlement history. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';

async function api(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname)) {
    throw new Error('This finance check is restricted to an explicitly confirmed local API.');
  }
  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME }, include: { user: { select: { id: true, phoneNumber: true } } },
  });
  assert(merchant, `Merchant '${SHOP_NAME}' was not found.`);
  const ownerPhone = merchant.user.phoneNumber || '+923019999904';
  if (!merchant.user.phoneNumber) {
    await prisma.user.update({ where: { id: merchant.user.id }, data: { phoneNumber: ownerPhone, isPhoneVerified: true } });
  }
  await api('POST', '/auth/send-otp', undefined, { phoneNumber: ownerPhone });
  const login = await api('POST', '/auth/verify-otp', undefined, { phoneNumber: ownerPhone, code: '123456', context: 'merchant' });
  assert(login.response.ok && login.data?.accessToken, 'Merchant login failed.');
  const token = login.data.accessToken as string;

  const before = await api('GET', '/merchant/earnings', token);
  assert(before.response.ok, `Initial earnings read failed (${before.response.status}).`);
  const customer = await prisma.customer.findFirst();
  assert(customer, 'No local customer exists for the finance fixture.');
  const suffix = Date.now().toString().slice(-8);
  const deliveredAt = new Date();
  const subtotalPaisa = 20_000;
  const commissionPaisa = 1_600;
  const earningPaisa = 18_400;
  const order = await prisma.order.create({
    data: {
      orderNumber: `SB-FIN-${suffix}`,
      customerId: customer.id,
      merchantId: merchant.id,
      status: 'DELIVERED',
      paymentStatus: 'CASH_COLLECTED',
      paymentMethod: 'COD',
      channel: 'ONLINE',
      subtotalPaisa,
      totalAmountPaisa: subtotalPaisa,
      commissionAmountPaisa: commissionPaisa,
      merchantEarningPaisa: earningPaisa,
      deliveredAt,
      customerNote: '[LOCAL QA] FINANCE TEST',
    },
  });
  const settlement = await prisma.settlement.create({
    data: {
      merchantId: merchant.id,
      amountPaisa: earningPaisa,
      status: 'PAID',
      startDate: new Date(deliveredAt.getTime() - 7 * 86400_000),
      endDate: deliveredAt,
      paidAt: deliveredAt,
      paymentReference: `LOCAL-QA-${suffix}`,
      adminNotes: `Local-only finance check for ${order.orderNumber}`,
    },
  });

  const after = await api('GET', '/merchant/earnings', token);
  assert(after.response.ok, `Populated earnings read failed (${after.response.status}).`);
  assert(after.data.grossSalesPaisa - before.data.grossSalesPaisa === subtotalPaisa, 'Gross sales did not increase by the fixture subtotal.');
  assert(after.data.commissionPaisa - before.data.commissionPaisa === commissionPaisa, 'Commission did not increase by the fixture commission.');
  assert(after.data.netPayablePaisa - before.data.netPayablePaisa === earningPaisa, 'Net payable did not increase by the fixture earning.');
  assert(after.data.byDay.some((day: any) => day.date === deliveredAt.toISOString().slice(0, 10)), 'Daily earnings bucket is missing.');

  const history = await api('GET', '/merchant/settlements', token);
  assert(history.response.ok && Array.isArray(history.data), 'Settlement history did not return an array.');
  const saved = history.data.find((item: any) => item.id === settlement.id);
  assert(saved?.amountPaisa === earningPaisa && saved?.status === 'PAID', 'Settlement was not returned with exact integer-paisa values.');
  const prohibited = await api('POST', '/merchant/settlements', token, { amountPaisa: 1 });
  assert([404, 405].includes(prohibited.response.status), `Merchant payout mutation unexpectedly returned ${prohibited.response.status}.`);

  console.log(`PASS settlement ${settlement.id}: populated earnings reconciled, history persisted, merchant payout mutation unavailable.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
