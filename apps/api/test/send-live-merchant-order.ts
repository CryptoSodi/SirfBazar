/**
 * Place one guarded local COD order through the real HTTP checkout path.
 * Unlike the direct fixture helper, this exercises persisted notifications and
 * the merchant `order:new` Socket.IO event.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';
const CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || '+923019999903';

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8')
    .split(/\r?\n/)
    .find((value) => value.startsWith('DATABASE_URL='));
  return line?.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '') || '';
}

function assertLocalTest() {
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1') {
    throw new Error('Refusing to create test data without CONFIRM_LOCAL_TEST_DATA=1.');
  }
  const api = new URL(API_URL);
  if (!['127.0.0.1', 'localhost'].includes(api.hostname)) {
    throw new Error('Refusing to send a test order to a non-local API.');
  }
  const database = new URL(databaseUrl());
  if (!['127.0.0.1', 'localhost'].includes(database.hostname)) {
    throw new Error('Refusing to modify a non-local database.');
  }
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  assertLocalTest();

  const merchant = await prisma.merchant.findFirst({ where: { shopName: SHOP_NAME } });
  if (!merchant) throw new Error(`Local merchant '${SHOP_NAME}' was not found.`);
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { approvalStatus: 'APPROVED', isOpen: true, isOnline: true },
  });

  const listing = await prisma.merchantProduct.findFirst({
    where: { merchantId: merchant.id },
    include: { product: true },
  });
  if (!listing) throw new Error(`No product listing exists for '${SHOP_NAME}'.`);
  await prisma.product.update({ where: { id: listing.productId }, data: { approvalStatus: 'APPROVED' } });
  await prisma.merchantProduct.update({
    where: { id: listing.id },
    data: { isAvailable: true, stockQuantity: { increment: 10 } },
  });

  const customerUser = await prisma.user.upsert({
    where: { phoneNumber: CUSTOMER_PHONE },
    update: { fullName: 'Realtime QA Customer', role: 'CUSTOMER', status: 'ACTIVE', isPhoneVerified: true },
    create: { phoneNumber: CUSTOMER_PHONE, fullName: 'Realtime QA Customer', role: 'CUSTOMER', status: 'ACTIVE', isPhoneVerified: true },
    include: { customer: true },
  });
  const customer = customerUser.customer ?? await prisma.customer.create({ data: { userId: customerUser.id } });
  const address = await prisma.customerAddress.findFirst({ where: { customerId: customer.id, label: 'Realtime Test' } })
    ?? await prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        label: 'Realtime Test',
        fullAddress: '24 Realtime Test Street, Lahore',
        area: 'Gulberg III',
        city: 'Lahore',
        province: 'Punjab',
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        contactName: 'Realtime QA Customer',
        contactPhone: CUSTOMER_PHONE,
        isDefault: true,
      },
    });

  await prisma.cart.updateMany({ where: { customerId: customer.id, status: 'ACTIVE' }, data: { status: 'ABANDONED' } });
  await prisma.cart.create({
    data: {
      customerId: customer.id,
      status: 'ACTIVE',
      items: {
        create: {
          merchantId: merchant.id,
          productId: listing.productId,
          merchantProductId: listing.id,
          quantity: 3,
          unitPricePaisa: listing.discountPricePaisa ?? listing.pricePaisa,
        },
      },
    },
  });

  await request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phoneNumber: CUSTOMER_PHONE }) });
  const session = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: CUSTOMER_PHONE, code: '123456', context: 'customer' }),
  });
  const order = await request('/orders', {
    method: 'POST',
    headers: { authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({
      deliveryAddressId: address.id,
      paymentMethod: 'COD',
      customerNote: '[LOCAL QA] REALTIME SOCKET TEST',
    }),
  });
  console.log(`Created ${order.orderNumber}; status ${order.status}; API checkout and order:new notification completed.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
