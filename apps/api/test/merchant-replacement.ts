/** Guarded local end-to-end unavailable-item/replacement acceptance check. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';
const CUSTOMER_PHONE = '+923019999903';

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

async function login(phoneNumber: string, context: 'merchant' | 'customer') {
  await request('POST', '/auth/send-otp', undefined, { phoneNumber });
  return request('POST', '/auth/verify-otp', undefined, { phoneNumber, code: '123456', context });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname)) {
    throw new Error('This replacement check is restricted to an explicitly confirmed local API.');
  }
  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME }, include: { user: { select: { id: true, phoneNumber: true } } },
  });
  assert(merchant, `Merchant '${SHOP_NAME}' was not found.`);
  const ownerPhone = merchant.user.phoneNumber || '+923019999904';
  if (!merchant.user.phoneNumber) {
    await prisma.user.update({ where: { id: merchant.user.id }, data: { phoneNumber: ownerPhone, isPhoneVerified: true } });
  }
  const customerUser = await prisma.user.findUnique({
    where: { phoneNumber: CUSTOMER_PHONE }, include: { customer: true },
  });
  assert(customerUser?.customer, 'Realtime QA customer was not found.');
  const original = await prisma.merchantProduct.findFirst({
    where: { merchantId: merchant.id, isAvailable: true }, include: { product: true }, orderBy: { createdAt: 'asc' },
  });
  assert(original, 'No original listing exists for the replacement check.');
  await prisma.merchantProduct.update({ where: { id: original.id }, data: { stockQuantity: { increment: 5 } } });

  const category = await prisma.category.findFirst();
  assert(category, 'No category exists for the replacement product.');
  const replacementProduct = await prisma.product.upsert({
    where: { slug: 'local-qa-replacement-item' },
    update: { approvalStatus: 'APPROVED' },
    create: {
      name: '[LOCAL QA] Replacement Item', slug: 'local-qa-replacement-item', categoryId: category.id,
      unit: 'piece', approvalStatus: 'APPROVED', createdByMerchantId: merchant.id,
    },
  });
  const replacement = await prisma.merchantProduct.upsert({
    where: { merchantId_productId: { merchantId: merchant.id, productId: replacementProduct.id } },
    update: { pricePaisa: 7_500, stockQuantity: 20, isAvailable: true },
    create: { merchantId: merchant.id, productId: replacementProduct.id, pricePaisa: 7_500, stockQuantity: 20, isAvailable: true },
  });
  const address = await prisma.customerAddress.findFirst({ where: { customerId: customerUser.customer.id } });
  const suffix = Date.now().toString().slice(-8);
  const quantity = 2;
  const originalPrice = original.discountPricePaisa ?? original.pricePaisa;
  const order = await prisma.$transaction(async (tx) => {
    await tx.merchantProduct.update({ where: { id: original.id }, data: { stockQuantity: { decrement: quantity } } });
    const created = await tx.order.create({
      data: {
        orderNumber: `SB-REPL-${suffix}`, customerId: customerUser.customer!.id, merchantId: merchant.id,
        deliveryAddressId: address?.id, status: 'SENT_TO_MERCHANT', paymentStatus: 'CASH_PENDING',
        paymentMethod: 'COD', channel: 'ONLINE', subtotalPaisa: originalPrice * quantity,
        totalAmountPaisa: originalPrice * quantity, merchantEarningPaisa: originalPrice * quantity,
        customerNote: '[LOCAL QA] REPLACEMENT TEST',
      },
    });
    const item = await tx.orderItem.create({
      data: {
        orderId: created.id, productId: original.productId, merchantProductId: original.id,
        productNameSnapshot: original.product.name, unitSnapshot: original.product.unit,
        quantity, unitPricePaisa: originalPrice, totalPricePaisa: originalPrice * quantity,
      },
    });
    return { ...created, item };
  });
  const originalReservedStock = (await prisma.merchantProduct.findUnique({ where: { id: original.id } }))!.stockQuantity;
  const replacementBefore = (await prisma.merchantProduct.findUnique({ where: { id: replacement.id } }))!.stockQuantity;

  const merchantSession = await login(ownerPhone, 'merchant');
  await request('POST', `/merchant/orders/${order.id}/items/${order.item.id}/unavailable`, merchantSession.accessToken, {
    replacementMerchantProductId: replacement.id,
  });
  const afterSuggestion = await request('GET', `/merchant/orders/${order.id}`, merchantSession.accessToken);
  const suggestion = afterSuggestion.items.find((item: any) => item.replacementForItemId === order.item.id);
  assert(suggestion?.itemStatus === 'REPLACEMENT_SUGGESTED', 'Replacement suggestion did not persist.');
  assert((await prisma.merchantProduct.findUnique({ where: { id: original.id } }))!.stockQuantity === originalReservedStock + quantity, 'Original stock was not restored.');
  assert((await prisma.merchantProduct.findUnique({ where: { id: replacement.id } }))!.stockQuantity === replacementBefore - quantity, 'Replacement stock was not reserved.');

  const customerSession = await login(CUSTOMER_PHONE, 'customer');
  await request('POST', `/orders/${order.id}/items/${order.item.id}/replacement`, customerSession.accessToken, { accept: true });
  const final = await request('GET', `/merchant/orders/${order.id}`, merchantSession.accessToken);
  assert(final.items.find((item: any) => item.id === order.item.id)?.itemStatus === 'REPLACED', 'Original item was not marked replaced.');
  assert(final.items.find((item: any) => item.id === suggestion.id)?.itemStatus === 'CONFIRMED', 'Accepted replacement was not confirmed.');
  assert(final.subtotalPaisa === replacement.pricePaisa * quantity, 'Order subtotal was not recomputed from the accepted replacement.');

  console.log(`PASS order ${order.orderNumber}: stock restored/reserved, replacement accepted, detail and totals persisted.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
