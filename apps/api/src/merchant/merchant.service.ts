import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { addCalendarMonthUtc, merchantPosTrialView, merchantTrial } from '../common/merchant-access-policy';
import {
  ACTIVE_ORDER_STATUSES,
  MerchantApprovalStatus,
  OrderStatus,
  RefundStatus,
  StaffPermission,
  UserRole,
} from '../common/constants';
import { OnboardMerchantDto, UpdateMerchantProfileDto, AddDocumentDto } from './merchant.dto';
import { reviewPosEntitlement } from '../auth/review-access';

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // ── Onboarding ─────────────────────────────────────────────────────────────

  private assertOperatingHours(hours?: OnboardMerchantDto['operatingHours']) {
    for (const day of hours ?? []) {
      if (day.isClosed) continue;
      const crossesMidnight = day.closesAt! <= day.opensAt!;
      if (crossesMidnight !== (day.closesNextDay === true)) {
        throw new BadRequestException(`Day ${day.dayOfWeek}: mark overnight hours only when closing time is at or before opening time.`);
      }
    }
  }

  async onboard(userId: string, dto: OnboardMerchantDto) {
    this.assertOperatingHours(dto.operatingHours);
    const existing = await this.prisma.merchant.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('This account already has a shop');
    const posTrialStartedAt = dto.posOptIn ? new Date() : null;

    const merchant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.merchant.create({
        data: {
          userId,
          shopName: dto.shopName,
          shopType: dto.shopType,
          description: dto.description ?? null,
          phoneNumber: dto.phoneNumber,
          address: dto.address,
          city: dto.city,
          area: dto.area ?? null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          serviceRadiusKm: dto.serviceRadiusKm ?? 5,
          deliveryFeePaisa: dto.deliveryFeePaisa ?? 0,
          openingTime: dto.openingTime ?? '09:00',
          closingTime: dto.closingTime ?? '21:00',
          minimumOrderValuePaisa: dto.minimumOrderValuePaisa ?? 0,
          averagePreparationMinutes: dto.averagePreparationMinutes ?? 20,
          logoUrl: dto.logoUrl ?? null,
          bannerUrl: dto.bannerUrl ?? null,
          // The shop is not public until the required identity image is stored.
          approvalStatus: MerchantApprovalStatus.DRAFT,
          isOnline: false,
          isOpen: false,
        },
      });
      // Permanent marker for shops created under the required-ID policy. It
      // survives admin status changes so DRAFT -> SUSPENDED -> APPROVED cannot
      // bypass identity upload, while legacy shops remain reactivatable.
      await tx.merchantDocument.create({
        data: { merchantId: created.id, documentType: 'IDENTITY', documentUrl: 'PENDING_PRIVATE_UPLOAD' },
      });
      if (dto.operatingHours) {
        await tx.merchantOperatingHours.createMany({
          data: dto.operatingHours.map((hours) => ({
            merchantId: created.id,
            dayOfWeek: hours.dayOfWeek,
            isClosed: hours.isClosed,
            opensAt: hours.isClosed ? null : hours.opensAt,
            closesAt: hours.isClosed ? null : hours.closesAt,
            closesNextDay: hours.isClosed ? false : hours.closesNextDay ?? false,
          })),
        });
      }
      await tx.merchantPosTrial.create({
        data: {
          userId,
          optedIn: dto.posOptIn ?? false,
          startedAt: posTrialStartedAt,
          endsAt: posTrialStartedAt ? addCalendarMonthUtc(posTrialStartedAt) : null,
        },
      });
      // Don't overwrite User.role — the account keeps any customer/rider access.
      // Merchant capability is the Merchant record itself; the merchant token is
      // minted on login by context (and the fresh token below).
      return created;
    });

    await this.audit.log({
      userId,
      role: UserRole.MERCHANT_OWNER,
      action: 'MERCHANT_ONBOARDED',
      entityType: 'Merchant',
      entityId: merchant.id,
      newValue: { shopName: merchant.shopName, city: merchant.city },
    });

    // Role changed — the old token is stale, hand back a fresh pair.
    const tokens = await this.auth.issueTokens(userId, UserRole.MERCHANT_OWNER);
    return {
      merchant: {
        ...merchant,
        trial: merchantTrial(merchant.createdAt),
        posTrial: merchantPosTrialView({
          optedIn: dto.posOptIn ?? false,
          startedAt: posTrialStartedAt,
          endsAt: posTrialStartedAt ? addCalendarMonthUtc(posTrialStartedAt) : null,
        }),
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    };
  }

  async addDocument(userId: string, dto: AddDocumentDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    return this.prisma.merchantDocument.create({
      data: {
        merchantId: ctx.merchantId,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
      },
    });
  }

  async uploadDocument(userId: string, documentType: string, file: any) {
    const ctx = await this.access.merchantContext(userId, { allowDisabled: documentType === 'IDENTITY' });
    this.access.requirePermission(ctx, StaffPermission.STORE);
    if (!['BUSINESS_REGISTRATION', 'IDENTITY', 'BANK_DETAILS', 'OTHER'].includes(documentType)) {
      throw new BadRequestException('Unsupported merchant document type');
    }
    if (!Buffer.isBuffer(file?.buffer) || !file.buffer.length || !file?.mimetype) throw new BadRequestException('No document uploaded');
    if (documentType === 'IDENTITY' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Choose a JPG, PNG or WebP image of your ID card.');
    }
    if (documentType === 'IDENTITY' && !this.isMatchingImage(file.buffer, file.mimetype)) {
      throw new BadRequestException('This ID-card file is not a valid image. Choose a JPG, PNG or WebP image.');
    }
    const extensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Only PDF, JPG, PNG and WebP documents are allowed');

    const document = await this.prisma.merchantDocument.create({
      data: { merchantId: ctx.merchantId, documentType, documentUrl: 'PENDING_PRIVATE_UPLOAD' },
    });
    const directory = join(process.cwd(), 'private-storage', 'merchant-documents');
    const filePath = join(directory, `${document.id}.${extension}`);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, file.buffer, { flag: 'wx' });
      return await this.prisma.$transaction(async (tx) => {
        const saved = await tx.merchantDocument.update({
          where: { id: document.id },
          data: { documentUrl: `/api/merchant/documents/${document.id}/file` },
        });
        // Only the owner who completed onboarding can activate a draft shop.
        // The conditional write cannot undo a concurrent admin disable.
        if (documentType === 'IDENTITY' && ctx.isOwner) {
          await tx.merchant.updateMany({
            where: { id: ctx.merchantId, userId, approvalStatus: MerchantApprovalStatus.DRAFT },
            data: { approvalStatus: MerchantApprovalStatus.APPROVED, isOnline: true, isOpen: true },
          });
        }
        return saved;
      });
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      await this.prisma.merchantDocument.delete({ where: { id: document.id } }).catch(() => undefined);
      throw error;
    }
  }

  private isMatchingImage(bytes: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/png') return bytes.length >= 45 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0 &&
      bytes.toString('ascii', bytes.length - 8, bytes.length - 4) === 'IEND';
    if (mimeType === 'image/jpeg') return bytes.length >= 32 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
      bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    if (mimeType === 'image/webp') return bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16));
    return false;
  }

  async documentFile(userId: string, documentId: string) {
    const ctx = await this.access.merchantContext(userId);
    const document = await this.prisma.merchantDocument.findFirst({
      where: { id: documentId, merchantId: ctx.merchantId },
    });
    if (!document || !document.documentUrl.startsWith('/api/merchant/documents/')) {
      throw new NotFoundException('Merchant document file not found');
    }
    const directory = join(process.cwd(), 'private-storage', 'merchant-documents');
    const filename = (await readdir(directory).catch(() => [] as string[]))
      .find((candidate) => candidate.startsWith(`${document.id}.`));
    if (!filename) throw new NotFoundException('Merchant document file not found');
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    };
    return {
      path: join(directory, filename),
      mimeType: mimeTypes[extension || ''] || 'application/octet-stream',
      downloadName: `${document.documentType.toLowerCase()}.${extension || 'bin'}`,
    };
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async profile(userId: string) {
    // Disabled shops can still read their status and contact support.
    const ctx = await this.access.merchantContext(userId, { allowDisabled: true });
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: ctx.merchantId },
      include: { documents: true, operatingHours: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const posTrial = await this.prisma.merchantPosTrial.findUnique({ where: { userId: merchant.userId } });
    return { ...merchant, documents: merchant.documents.filter((document) => document.documentUrl !== 'PENDING_PRIVATE_UPLOAD'), trial: merchantTrial(merchant.createdAt), posTrial: reviewPosEntitlement(merchant.id) ?? merchantPosTrialView(posTrial), isOwner: ctx.isOwner, permissions: ctx.permissions };
  }

  async updateProfile(userId: string, dto: UpdateMerchantProfileDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    this.assertOperatingHours(dto.operatingHours);
    const merchant = await this.prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: ctx.merchantId },
        data: {
          shopName: dto.shopName ?? undefined,
          description: dto.description ?? undefined,
          phoneNumber: dto.phoneNumber ?? undefined,
          address: dto.address ?? undefined,
          city: dto.city ?? undefined,
          area: dto.area ?? undefined,
          latitude: dto.latitude ?? undefined,
          longitude: dto.longitude ?? undefined,
          serviceRadiusKm: dto.serviceRadiusKm ?? undefined,
          deliveryFeePaisa: dto.deliveryFeePaisa ?? undefined,
          openingTime: dto.openingTime ?? undefined,
          closingTime: dto.closingTime ?? undefined,
          minimumOrderValuePaisa: dto.minimumOrderValuePaisa ?? undefined,
          averagePreparationMinutes: dto.averagePreparationMinutes ?? undefined,
          logoUrl: dto.logoUrl ?? undefined,
          bannerUrl: dto.bannerUrl ?? undefined,
        },
      });
      if (dto.operatingHours) {
        await tx.merchantOperatingHours.deleteMany({ where: { merchantId: ctx.merchantId } });
        await tx.merchantOperatingHours.createMany({
          data: dto.operatingHours.map((hours) => ({
            merchantId: ctx.merchantId,
            dayOfWeek: hours.dayOfWeek,
            isClosed: hours.isClosed,
            opensAt: hours.isClosed ? null : hours.opensAt,
            closesAt: hours.isClosed ? null : hours.closesAt,
            closesNextDay: hours.isClosed ? false : hours.closesNextDay ?? false,
          })),
        });
      }
      return tx.merchant.findUniqueOrThrow({
        where: { id: ctx.merchantId },
        include: { operatingHours: { orderBy: { dayOfWeek: 'asc' } } },
      });
    });
    return merchant;
  }

  async setOnline(userId: string, online: boolean) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    const saved = await this.prisma.merchant.updateMany({
      where: { id: ctx.merchantId, ...(online ? { approvalStatus: MerchantApprovalStatus.APPROVED } : {}) },
      data: { isOnline: online },
    });
    if (saved.count !== 1) throw new BadRequestException('This shop is not active. Contact support to restore access.');
    return { ok: true, isOnline: online };
  }

  async setAvailability(userId: string, open: boolean) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    const saved = await this.prisma.merchant.updateMany({
      where: { id: ctx.merchantId, ...(open ? { approvalStatus: MerchantApprovalStatus.APPROVED } : {}) },
      data: { isOnline: open, isOpen: open },
    });
    if (saved.count !== 1) throw new BadRequestException('This shop is not active. Contact support to restore access.');
    return { ok: true, isOnline: open, isOpen: open };
  }

  async setOpen(userId: string, open: boolean) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    const saved = await this.prisma.merchant.updateMany({
      where: { id: ctx.merchantId, ...(open ? { approvalStatus: MerchantApprovalStatus.APPROVED } : {}) },
      data: { isOpen: open },
    });
    if (saved.count !== 1) throw new BadRequestException('This shop is not active. Contact support to restore access.');
    return { ok: true, isOpen: open };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async dashboard(userId: string) {
    const ctx = await this.access.merchantContext(userId);
    const merchantId = ctx.merchantId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    const monthAgo = new Date(Date.now() - 30 * 86400_000);

    const [
      merchant,
      todayOrders,
      pendingOrders,
      preparingOrders,
      readyOrders,
      activeDeliveries,
      completedToday,
      cancelledToday,
      todayAgg,
      weekAgg,
      monthAgg,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.merchant.findUnique({ where: { id: merchantId } }),
      this.prisma.order.count({ where: { merchantId, channel: 'ONLINE', createdAt: { gte: startOfToday } } }),
      this.prisma.order.count({ where: { merchantId, status: OrderStatus.SENT_TO_MERCHANT } }),
      this.prisma.order.count({
        where: { merchantId, status: { in: [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING] } },
      }),
      this.prisma.order.count({ where: { merchantId, status: OrderStatus.READY_FOR_PICKUP } }),
      this.prisma.order.count({
        where: {
          merchantId,
          status: {
            in: [
              OrderStatus.RIDER_ASSIGNED,
              OrderStatus.RIDER_ARRIVED_AT_SHOP,
              OrderStatus.PICKED_UP,
              OrderStatus.ON_THE_WAY,
              OrderStatus.RIDER_ARRIVED_AT_CUSTOMER,
            ],
          },
        },
      }),
      this.prisma.order.count({
        where: { merchantId, status: OrderStatus.DELIVERED, channel: 'ONLINE', deliveredAt: { gte: startOfToday } },
      }),
      this.prisma.order.count({
        where: {
          merchantId,
          status: {
            in: [
              OrderStatus.MERCHANT_REJECTED,
              OrderStatus.CANCELLED_BY_CUSTOMER,
              OrderStatus.CANCELLED_BY_MERCHANT,
              OrderStatus.CANCELLED_BY_ADMIN,
            ],
          },
          createdAt: { gte: startOfToday },
        },
      }),
      this.salesAggregate(merchantId, startOfToday),
      this.salesAggregate(merchantId, weekAgo),
      this.salesAggregate(merchantId, monthAgo),
      this.prisma.merchantProduct.count({
        where: {
          merchantId,
          stockQuantity: { lte: this.prisma.merchantProduct.fields.lowStockThreshold },
        },
      }),
    ]);

    return {
      todayOrders,
      pendingOrders,
      preparingOrders,
      readyOrders,
      activeDeliveries,
      completedToday,
      cancelledToday,
      todaySalesPaisa: todayAgg.sales,
      weekSalesPaisa: weekAgg.sales,
      monthSalesPaisa: monthAgg.sales,
      commissionPaisa: monthAgg.commission,
      netEarningsPaisa: monthAgg.earnings,
      lowStockProducts,
      ratingAverage: merchant?.ratingAverage ?? 0,
      ratingCount: merchant?.ratingCount ?? 0,
      isOnline: merchant?.isOnline ?? false,
      isOpen: merchant?.isOpen ?? false,
      approvalStatus: merchant?.approvalStatus,
    };
  }

  private async salesAggregate(merchantId: string, since: Date) {
    const agg = await this.prisma.order.aggregate({
      // Online orders only — POS cash sales are reported in the POS app and are
      // never settled by the platform, so they must not inflate these figures.
      where: { merchantId, status: OrderStatus.DELIVERED, channel: 'ONLINE', deliveredAt: { gte: since } },
      _sum: { totalAmountPaisa: true, commissionAmountPaisa: true, merchantEarningPaisa: true },
    });
    return {
      sales: agg._sum.totalAmountPaisa ?? 0,
      commission: agg._sum.commissionAmountPaisa ?? 0,
      earnings: agg._sum.merchantEarningPaisa ?? 0,
    };
  }

  // ── Earnings & settlements ─────────────────────────────────────────────────

  async earnings(userId: string, from?: string, to?: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.FINANCE);
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
    const toDate = to ? new Date(to) : new Date();

    const orders = await this.prisma.order.findMany({
      where: {
        merchantId: ctx.merchantId,
        status: OrderStatus.DELIVERED,
        // Only marketplace orders are payable by the platform; POS cash is already
        // in the shop's hand — mirrors the settlement generation filter so "Net
        // payable" reconciles with what settlements actually pay out.
        channel: 'ONLINE',
        deliveredAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        deliveredAt: true,
        totalAmountPaisa: true,
        subtotalPaisa: true,
        commissionAmountPaisa: true,
        merchantEarningPaisa: true,
      },
    });

    const refunds = await this.prisma.refund.aggregate({
      where: {
        status: RefundStatus.COMPLETED,
        order: { merchantId: ctx.merchantId },
        completedAt: { gte: fromDate, lte: toDate },
      },
      _sum: { amountPaisa: true },
    });

    const byDayMap = new Map<string, { salesPaisa: number; orders: number }>();
    for (const o of orders) {
      const day = (o.deliveredAt ?? new Date()).toISOString().slice(0, 10);
      const entry = byDayMap.get(day) ?? { salesPaisa: 0, orders: 0 };
      entry.salesPaisa += o.subtotalPaisa;
      entry.orders += 1;
      byDayMap.set(day, entry);
    }

    return {
      grossSalesPaisa: orders.reduce((s, o) => s + o.subtotalPaisa, 0),
      commissionPaisa: orders.reduce((s, o) => s + o.commissionAmountPaisa, 0),
      netPayablePaisa:
        orders.reduce((s, o) => s + o.merchantEarningPaisa, 0) - (refunds._sum.amountPaisa ?? 0),
      refundDeductionsPaisa: refunds._sum.amountPaisa ?? 0,
      deliveredOrders: orders.length,
      byDay: [...byDayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
    };
  }

  async settlements(userId: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.FINANCE);
    return this.prisma.settlement.findMany({
      where: { merchantId: ctx.merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
