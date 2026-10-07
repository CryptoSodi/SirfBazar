/** Guarded local persistence checks for merchant product, rider and staff mutations. */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';

async function request(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function merchantToken(phoneNumber: string) {
  await request('POST', '/auth/send-otp', undefined, { phoneNumber });
  const session = await request('POST', '/auth/verify-otp', undefined, {
    phoneNumber, code: '123456', context: 'merchant',
  });
  return session.accessToken as string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname)) {
    throw new Error('This mutation suite is restricted to an explicitly confirmed local API.');
  }
  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME }, include: { user: { select: { id: true, phoneNumber: true } } },
  });
  assert(merchant, `Merchant '${SHOP_NAME}' was not found.`);
  const ownerPhone = merchant.user.phoneNumber || '+923019999904';
  if (!merchant.user.phoneNumber) {
    await prisma.user.update({ where: { id: merchant.user.id }, data: { phoneNumber: ownerPhone, isPhoneVerified: true } });
  }
  const token = await merchantToken(ownerPhone);
  const suffix = Date.now().toString().slice(-7);

  const category = await prisma.category.findFirst({ orderBy: { createdAt: 'asc' } });
  assert(category, 'No category exists for the bulk product check.');
  const productName = `[LOCAL QA] Mutation Product ${suffix}`;
  const importRequest = {
    requestId: randomUUID(), mode: 'ADD_MISSING' as const,
    items: [{ rowId: `product-${suffix}`, name: productName, categoryId: category.id, unit: 'piece', pricePaisa: 12_300, stockQuantity: 9 }],
  };
  const preview = await request('POST', '/merchant/products/bulk-preview', token, importRequest);
  assert(preview.rows?.[0]?.status === 'NEW' && preview.previewToken, `Bulk preview was not ready: ${JSON.stringify(preview)}`);
  const bulk = await request('POST', '/merchant/products/bulk-upload', token, { ...importRequest, previewToken: preview.previewToken });
  assert(bulk.created === 1 && bulk.failed.length === 0, `Bulk product result was not successful: ${JSON.stringify(bulk)}`);
  let products = await request('GET', `/merchant/products?q=${encodeURIComponent(productName)}&pageSize=20`, token);
  const listing = products.items?.find((item: any) => item.product?.name === productName);
  assert(listing, 'Bulk-created product was not returned by refetch.');
  await request('PUT', `/merchant/products/${listing.id}`, token, {
    pricePaisa: 13_500, stockQuantity: 11, lowStockThreshold: 2, merchantSku: `QA-${suffix}`,
  });
  products = await request('GET', `/merchant/products?q=${encodeURIComponent(productName)}&pageSize=20`, token);
  const updatedListing = products.items?.find((item: any) => item.id === listing.id);
  assert(updatedListing?.pricePaisa === 13_500 && updatedListing?.merchantSku === `QA-${suffix}`, 'Product update did not persist.');
  await request('DELETE', `/merchant/products/${listing.id}`, token);
  products = await request('GET', `/merchant/products?q=${encodeURIComponent(productName)}&pageSize=20`, token);
  assert(products.items?.find((item: any) => item.id === listing.id)?.isAvailable === false, 'Product removal did not persist as unavailable.');

  const riderPhone = `+92308${suffix}`;
  const rider = await request('POST', '/merchant/riders', token, {
    fullName: `QA Rider ${suffix}`, phoneNumber: riderPhone, vehicleType: 'BICYCLE', vehicleNumber: `QA-${suffix}`,
  });
  await request('PUT', `/merchant/riders/${rider.id}`, token, {
    fullName: `QA Rider Updated ${suffix}`, vehicleType: 'MOTORBIKE', vehicleNumber: `QAU-${suffix}`,
  });
  let riderDetail = await request('GET', `/merchant/riders/${rider.id}`, token);
  assert(riderDetail.fullName === `QA Rider Updated ${suffix}` && riderDetail.vehicleType === 'MOTORBIKE', 'Rider update did not persist.');
  await request('DELETE', `/merchant/riders/${rider.id}`, token);
  riderDetail = await request('GET', `/merchant/riders/${rider.id}`, token);
  assert(riderDetail.isActive === false && riderDetail.isOnline === false, 'Rider removal did not persist as inactive/offline.');

  const staffPhone = `+92307${suffix}`;
  const staff = await request('POST', '/merchant/staff', token, {
    fullName: `QA Staff ${suffix}`, phoneNumber: staffPhone, roleName: 'Order assistant', permissions: ['ORDERS'],
  });
  await request('PUT', `/merchant/staff/${staff.id}`, token, {
    roleName: 'Inventory assistant', permissions: ['ORDERS', 'INVENTORY'], status: 'ACTIVE',
  });
  let staffList = await request('GET', '/merchant/staff', token);
  let staffDetail = staffList.find((item: any) => item.id === staff.id);
  assert(staffDetail?.roleName === 'Inventory assistant' && staffDetail.permissions.includes('INVENTORY'), 'Staff update did not persist.');
  await request('PUT', `/merchant/staff/${staff.id}`, token, { status: 'DISABLED' });
  await request('DELETE', `/merchant/staff/${staff.id}`, token);
  staffList = await request('GET', '/merchant/staff', token);
  staffDetail = staffList.find((item: any) => item.id === staff.id);
  assert(staffDetail?.status === 'DISABLED', 'Staff disable/removal did not persist.');

  console.log(`PASS product ${listing.id}, rider ${rider.id}, staff ${staff.id}: mutations persisted after refetch.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
