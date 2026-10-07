/** Guarded local support-ticket ownership and persistence check. */
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

async function login(phoneNumber: string, context: 'merchant' | 'customer') {
  await api('POST', '/auth/send-otp', undefined, { phoneNumber });
  return api('POST', '/auth/verify-otp', undefined, { phoneNumber, code: '123456', context });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname)) {
    throw new Error('This support check is restricted to an explicitly confirmed local API.');
  }
  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME }, include: { user: { select: { id: true, phoneNumber: true } } },
  });
  assert(merchant, `Merchant '${SHOP_NAME}' was not found.`);
  const ownerPhone = merchant.user.phoneNumber || '+923019999904';
  if (!merchant.user.phoneNumber) {
    await prisma.user.update({ where: { id: merchant.user.id }, data: { phoneNumber: ownerPhone, isPhoneVerified: true } });
  }
  await prisma.otpCode.deleteMany({ where: { phoneNumber: { in: [ownerPhone, '+923019999903'] } } });
  const merchantLogin = await login(ownerPhone, 'merchant');
  assert(merchantLogin.response.ok && merchantLogin.data?.accessToken, 'Merchant login failed.');
  const token = merchantLogin.data.accessToken as string;
  const suffix = Date.now().toString().slice(-8);
  const created = await api('POST', '/support/tickets', token, {
    issueCategory: 'TECHNICAL',
    title: `[LOCAL QA] Merchant support ${suffix}`,
    description: 'Local-only ticket used to verify merchant support persistence.',
  });
  assert(created.response.status === 201 && created.data?.id, `Ticket creation failed (${created.response.status}).`);
  const message = await api('POST', `/support/tickets/${created.data.id}/messages`, token, {
    message: 'Local merchant follow-up message.',
  });
  assert(message.response.status === 201 && message.data?.id, 'Merchant ticket message was not saved.');
  const detail = await api('GET', `/support/tickets/${created.data.id}`, token);
  assert(detail.response.ok && detail.data.messages?.some((item: any) => item.id === message.data.id), 'Ticket detail did not include the saved message.');
  const list = await api('GET', '/support/tickets', token);
  assert(list.response.ok && list.data.some((item: any) => item.id === created.data.id), 'Ticket list did not include the created ticket.');

  const customerLogin = await login('+923019999903', 'customer');
  assert(customerLogin.response.ok && customerLogin.data?.accessToken, 'Isolation-test customer login failed.');
  const forbidden = await api('GET', `/support/tickets/${created.data.id}`, customerLogin.data.accessToken);
  assert(forbidden.response.status === 403, `Another user read the merchant ticket (${forbidden.response.status}).`);

  console.log(`PASS ticket ${created.data.id}: create/list/detail/message persisted and cross-user read returned 403.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
