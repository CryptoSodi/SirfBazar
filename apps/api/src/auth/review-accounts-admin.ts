import { PrismaClient, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as bcrypt from 'bcryptjs';
import { REVIEW_ACCOUNTS, REVIEW_COUPON_ID, REVIEW_CUSTOMER_ID, REVIEW_MEMBER_PREFIX, REVIEW_RIDER_ID, REVIEW_SHOP_ID, reviewCodeHash } from './review-access';

export async function provisionReviewAccounts(db: PrismaClient) {
  for (const account of REVIEW_ACCOUNTS) reviewCodeHash(account.phone, 'LOGIN');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('play-review-provision-v1'))`;
    for (const account of REVIEW_ACCOUNTS) {
      const existing = await tx.user.findFirst({ where: { OR: [{ id: account.userId }, { phoneNumber: account.phone }] } });
      if (existing && (existing.id !== account.userId || existing.phoneNumber !== account.phone || existing.role !== account.role || existing.googleId || existing.passwordHash)) {
        throw new Error('Reserved review identity conflicts with an existing account. No records changed.');
      }
    }
    const existingShop = await tx.merchant.findUnique({ where: { id: REVIEW_SHOP_ID } });
    if (existingShop && existingShop.userId !== REVIEW_ACCOUNTS[1].userId) throw new Error('Review shop owner mismatch.');
    const existingCustomer = await tx.customer.findUnique({ where: { userId: REVIEW_ACCOUNTS[0].userId } });
    if (existingCustomer && existingCustomer.id !== REVIEW_CUSTOMER_ID) throw new Error('Review customer profile mismatch.');
    const existingRider = await tx.rider.findUnique({ where: { userId: REVIEW_ACCOUNTS[2].userId } });
    if (existingRider && (existingRider.id !== REVIEW_RIDER_ID || existingRider.merchantId !== REVIEW_SHOP_ID)) throw new Error('Review rider membership mismatch.');
    if (await tx.merchantStaff.count({ where: { OR: [{ merchantId: REVIEW_SHOP_ID, userId: { not: { startsWith: REVIEW_MEMBER_PREFIX } } }, { userId: { in: REVIEW_ACCOUNTS.map(a => a.userId) } }] } })) throw new Error('Review staff must be isolated demo records.');

    const products = await tx.product.findMany({ where: {
      approvalStatus: 'APPROVED', isRestricted: false, requiresPrescription: false,
      category: { isActive: true, isRestricted: false },
    }, orderBy: { id: 'asc' }, take: 5, select: { id: true } });
    if (!products.length) throw new Error('At least one existing unrestricted catalogue product is required.');
    for (const account of REVIEW_ACCOUNTS) {
      await tx.user.upsert({ where: { id: account.userId }, update: { status: 'ACTIVE' }, create: {
        id: account.userId, phoneNumber: account.phone, role: account.role,
        fullName: `SirfBazar Store Review ${account.context}`, status: 'ACTIVE', isPhoneVerified: true,
      } });
    }
    await tx.customer.upsert({ where: { id: REVIEW_CUSTOMER_ID }, update: {}, create: { id: REVIEW_CUSTOMER_ID, userId: REVIEW_ACCOUNTS[0].userId } });
    await tx.merchant.upsert({ where: { id: REVIEW_SHOP_ID }, update: { approvalStatus: 'APPROVED', isOnline: true, isOpen: true }, create: {
      id: REVIEW_SHOP_ID, userId: REVIEW_ACCOUNTS[1].userId, shopName: 'SirfBazar Review Demo - No Real Delivery', shopType: 'GROCERY',
      description: 'Isolated app-store review shop. No real purchases, cash collection, or delivery.',
      phoneNumber: REVIEW_ACCOUNTS[1].phone, address: 'Store-review fixture, Lahore', city: 'Lahore', area: 'Review demo',
      latitude: 31.5826, longitude: 74.3276, serviceRadiusKm: 5,
      approvalStatus: 'APPROVED', isOnline: true, isOpen: true, openingTime: '00:00', closingTime: '23:59',
      commissionValue: 0, minimumOrderValuePaisa: 0,
    } });
    await tx.rider.upsert({ where: { id: REVIEW_RIDER_ID }, update: { isActive: true, approvalStatus: 'APPROVED' }, create: {
      id: REVIEW_RIDER_ID, userId: REVIEW_ACCOUNTS[2].userId, merchantId: REVIEW_SHOP_ID,
      fullName: 'SirfBazar Store Review Rider', phoneNumber: REVIEW_ACCOUNTS[2].phone, approvalStatus: 'APPROVED', isActive: true,
    } });
    for (const product of products) await tx.merchantProduct.upsert({
      where: { merchantId_productId: { merchantId: REVIEW_SHOP_ID, productId: product.id } }, update: {},
      create: { merchantId: REVIEW_SHOP_ID, productId: product.id, pricePaisa: 10000, stockQuantity: 100, merchantSku: `REVIEW-${product.id}` },
    });
    await tx.customerAddress.upsert({ where: { id: 'play-review-v1-address' }, update: {}, create: {
      id: 'play-review-v1-address', customerId: REVIEW_CUSTOMER_ID, label: 'Review demo', fullAddress: 'Store-review fixture - do not deliver',
      city: 'Lahore', latitude: 31.5826, longitude: 74.3276, contactName: 'Store Reviewer', contactPhone: REVIEW_ACCOUNTS[0].phone, isDefault: true,
    } });
    await tx.customer.update({ where: { id: REVIEW_CUSTOMER_ID }, data: { defaultAddressId: 'play-review-v1-address' } });
    await tx.coupon.upsert({ where: { id: REVIEW_COUPON_ID }, update: { isActive: true }, create: {
      id: REVIEW_COUPON_ID, code: 'PLAYREVIEW', title: 'Isolated review coupon', discountType: 'FIXED', discountValue: 100,
      applicableMerchantId: REVIEW_SHOP_ID, startDate: new Date('2020-01-01'), endDate: new Date('9999-12-31'), usageLimitPerCustomer: 2147483647,
    } });
    await tx.auditLog.create({ data: { action: 'PLAY_REVIEW_PROVISIONED', entityType: 'Merchant', entityId: REVIEW_SHOP_ID,
      newValue: JSON.stringify({ userIds: REVIEW_ACCOUNTS.map(a => a.userId), revocation: 'manual' }) } });
    return { provisioned: true, shopId: REVIEW_SHOP_ID, users: 3, listingCount: products.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}

export async function disableReviewAccounts(db: PrismaClient) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('play-review-provision-v1'))`;
    const userIds = REVIEW_ACCOUNTS.map(a => a.userId);
    const now = new Date();
    await tx.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'SUSPENDED' } });
    const sessions = await tx.refreshToken.updateMany({ where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: now } });
    await tx.otpCode.updateMany({ where: { phoneNumber: { in: REVIEW_ACCOUNTS.map(a => a.phone) }, consumedAt: null }, data: { consumedAt: now } });
    await tx.merchant.updateMany({ where: { id: REVIEW_SHOP_ID }, data: { isOnline: false, isOpen: false, approvalStatus: 'SUSPENDED' } });
    await tx.rider.updateMany({ where: { merchantId: REVIEW_SHOP_ID }, data: { isOnline: false, isActive: false } });
    await tx.merchantStaff.updateMany({ where: { merchantId: REVIEW_SHOP_ID }, data: { status: 'DISABLED' } });
    await tx.coupon.updateMany({ where: { id: REVIEW_COUPON_ID }, data: { isActive: false } });
    await tx.auditLog.create({ data: { action: 'PLAY_REVIEW_DISABLED', entityType: 'Merchant', entityId: REVIEW_SHOP_ID, newValue: JSON.stringify({ revokedSessions: sessions.count }) } });
    return { disabled: true, revokedSessions: sessions.count, dataPreserved: true };
  });
}

async function main() {
  const [command, approval, directory] = process.argv.slice(2);
  if (approval !== '--approved' || !['prepare', 'provision', 'disable', 'status'].includes(command)) throw new Error('Usage: review-accounts-admin.js prepare|provision|disable|status --approved [new-private-directory]');
  if (command === 'prepare') {
    if (!directory) throw new Error('A new private output directory is required.');
    const output = resolve(directory);
    mkdirSync(output, { mode: 0o700 }); // Refuse overwrite; never rotate existing credentials silently.
    const codes = new Set<string>();
    const credentials: Array<{ app: string; phone: string; code: string; revocation: string }> = [];
    const env = ['PLAY_REVIEW_ENABLED=true'];
    for (const account of REVIEW_ACCOUNTS) {
      let code: string;
      do { code = String(randomInt(100000, 1000000)); } while (codes.has(code) || code === '123456');
      codes.add(code);
      env.push(`PLAY_REVIEW_${account.context.toUpperCase()}_CODE_HASH=${await bcrypt.hash(code, 12)}`);
      credentials.push({ app: account.context, phone: account.phone, code, revocation: 'manual' });
    }
    writeFileSync(resolve(output, 'review.env'), env.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
    writeFileSync(resolve(output, 'review-credentials.json'), JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ prepared: true, directory: output, revocation: 'manual', secretsPrinted: false }));
    return;
  }
  const db = new PrismaClient();
  try {
    const result = command === 'provision' ? await provisionReviewAccounts(db)
      : command === 'disable' ? await disableReviewAccounts(db)
      : await db.user.findMany({ where: { id: { in: REVIEW_ACCOUNTS.map(a => a.userId) } }, select: { id: true, status: true, role: true } });
    console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); }
}

if (require.main === module) main().catch(() => { console.error('Review operation failed. No credentials were printed. Inspect configuration and identity conflicts.'); process.exitCode = 1; });
