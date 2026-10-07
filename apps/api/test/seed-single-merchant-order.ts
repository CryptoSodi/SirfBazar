/** Create one idempotent order for exercising the local merchant UI. */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const prisma = new PrismaClient();
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';
const CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || '+923019999902';
const NOTE = process.env.TEST_ORDER_NOTE || '[LOCAL QA] MERCHANT UI TEST';

function configuredDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), '.env');
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((value) => value.startsWith('DATABASE_URL='));
  return line?.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
}

function assertLocalDatabase() {
  const raw = configuredDatabaseUrl();
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !raw) {
    throw new Error('Refusing to create test data without CONFIRM_LOCAL_TEST_DATA=1 and DATABASE_URL.');
  }
  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Refusing to create test data outside a local database.');
  }
}

async function ensureNotification(userId: string, order: { id: string; orderNumber: string; totalAmountPaisa: number }) {
  const existing = await prisma.notification.findFirst({ where: { userId, type: 'NEW_ORDER', referenceId: order.id } });
  if (!existing) {
    await prisma.notification.create({
      data: {
        userId,
        title: 'New order received',
        body: `Local QA Customer placed order ${order.orderNumber} (Rs ${(order.totalAmountPaisa / 100).toFixed(0)}).`,
        type: 'NEW_ORDER',
        referenceId: order.id,
      },
    });
  } else if (existing.isRead) {
    await prisma.notification.update({ where: { id: existing.id }, data: { isRead: false } });
  }
}

async function main() {
  assertLocalDatabase();
  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME },
    include: { user: true, staff: { where: { status: 'ACTIVE' }, select: { userId: true } } },
  });
  if (!merchant) throw new Error(`Local merchant '${SHOP_NAME}' was not found.`);

  const existing = await prisma.order.findFirst({
    where: { merchantId: merchant.id, customerNote: NOTE, status: 'SENT_TO_MERCHANT' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    await Promise.all([merchant.userId, ...merchant.staff.map((member) => member.userId)].map((userId) => ensureNotification(userId, existing)));
    console.log(`Existing test order ${existing.orderNumber} is ready for ${merchant.shopName}; its notification is unread.`);
    return;
  }

  const customerUser = await prisma.user.upsert({
    where: { phoneNumber: CUSTOMER_PHONE },
    update: { fullName: 'Local QA Customer', status: 'ACTIVE', isPhoneVerified: true },
    create: { phoneNumber: CUSTOMER_PHONE, fullName: 'Local QA Customer', role: 'CUSTOMER', status: 'ACTIVE', isPhoneVerified: true },
    include: { customer: true },
  });
  const customer = customerUser.customer ?? await prisma.customer.create({ data: { userId: customerUser.id } });
  const address = await prisma.customerAddress.findFirst({ where: { customerId: customer.id, label: 'Merchant UI Test' } })
    ?? await prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        label: 'Merchant UI Test',
        fullAddress: '12 Test Lane, Gulberg III, Lahore',
        area: 'Gulberg III',
        city: 'Lahore',
        province: 'Punjab',
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        contactName: 'Local QA Customer',
        contactPhone: CUSTOMER_PHONE,
        isDefault: true,
      },
    });

  let listing = await prisma.merchantProduct.findFirst({
    where: { merchantId: merchant.id, isAvailable: true, stockQuantity: { gte: 2 }, product: { approvalStatus: 'APPROVED' } },
    include: { product: true },
  });
  if (!listing) {
    const product = await prisma.product.findFirst({ where: { approvalStatus: 'APPROVED' }, orderBy: { createdAt: 'asc' } });
    if (!product) throw new Error('No approved product exists for the test order.');
    listing = await prisma.merchantProduct.upsert({
      where: { merchantId_productId: { merchantId: merchant.id, productId: product.id } },
      update: { pricePaisa: 50_000, stockQuantity: 20, isAvailable: true, merchantSku: 'LOCAL-QA-001' },
      create: { merchantId: merchant.id, productId: product.id, pricePaisa: 50_000, stockQuantity: 20, lowStockThreshold: 3, isAvailable: true, merchantSku: 'LOCAL-QA-001' },
      include: { product: true },
    });
  }

  const quantity = 2;
  const subtotalPaisa = listing.pricePaisa * quantity;
  const commissionAmountPaisa = merchant.commissionType === 'FIXED'
    ? Math.round(merchant.commissionValue)
    : Math.round(subtotalPaisa * merchant.commissionValue / 100);
  const orderNumber = `SB-TEST-${Date.now().toString().slice(-8)}`;

  const order = await prisma.$transaction(async (tx) => {
    const stock = await tx.merchantProduct.updateMany({
      where: { id: listing.id, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (stock.count !== 1) throw new Error('The selected test product no longer has enough stock.');
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        merchantId: merchant.id,
        deliveryAddressId: address.id,
        status: 'SENT_TO_MERCHANT',
        paymentStatus: 'CASH_PENDING',
        paymentMethod: 'COD',
        channel: 'ONLINE',
        subtotalPaisa,
        commissionAmountPaisa,
        totalAmountPaisa: subtotalPaisa,
        merchantEarningPaisa: subtotalPaisa - commissionAmountPaisa,
        customerNote: NOTE,
        deliveryOtp: '1234',
        estimatedDeliveryMinutes: merchant.averagePreparationMinutes + 20,
      },
    });
    await tx.orderItem.create({
      data: {
        orderId: created.id,
        productId: listing.productId,
        merchantProductId: listing.id,
        productNameSnapshot: listing.product.name,
        productImageSnapshot: listing.product.imageUrl,
        unitSnapshot: listing.product.unit,
        quantity,
        unitPricePaisa: listing.pricePaisa,
        totalPricePaisa: subtotalPaisa,
      },
    });
    await tx.orderTimelineEntry.createMany({ data: [
      { orderId: created.id, status: 'CREATED', changedByUserId: customerUser.id, changedByRole: 'CUSTOMER' },
      { orderId: created.id, status: 'SENT_TO_MERCHANT', changedByRole: 'SYSTEM' },
    ] });
    await tx.payment.create({
      data: { orderId: created.id, customerId: customer.id, amountPaisa: subtotalPaisa, paymentMethod: 'COD', paymentProvider: 'cod', status: 'CASH_PENDING' },
    });
    return created;
  });

  await Promise.all([merchant.userId, ...merchant.staff.map((member) => member.userId)].map((userId) => ensureNotification(userId, order)));
  console.log(`Created ${order.orderNumber} for ${merchant.shopName}; status ${order.status}; unread notification created.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
