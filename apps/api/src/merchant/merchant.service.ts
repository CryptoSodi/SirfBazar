import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import {
  ACTIVE_ORDER_STATUSES,
  MerchantApprovalStatus,
  OrderStatus,
  RefundStatus,
  StaffPermission,
  UserRole,
} from '../common/constants';
import { OnboardMerchantDto, UpdateMerchantProfileDto, AddDocumentDto } from './merchant.dto';

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // ── Onboarding ─────────────────────────────────────────────────────────────

  async onboard(userId: string, dto: OnboardMerchantDto) {
    const existing = await this.prisma.merchant.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('This account already has a shop');

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
          openingTime: dto.openingTime ?? '09:00',
          closingTime: dto.closingTime ?? '21:00',
          minimumOrderValuePaisa: dto.minimumOrderValuePaisa ?? 0,
          averagePreparationMinutes: dto.averagePreparationMinutes ?? 20,
          approvalStatus: MerchantApprovalStatus.SUBMITTED,
          isOnline: false,
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
    return { merchant, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async addDocument(userId: string, dto: AddDocumentDto) {
    const ctx = await this.access.merchantContext(userId);
    return this.prisma.merchantDocument.create({
      data: {
        merchantId: ctx.merchantId,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
      },
    });
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async profile(userId: string) {
    const ctx = await this.access.merchantContext(userId);
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: ctx.merchantId },
      include: { documents: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return { ...merchant, isOwner: ctx.isOwner, permissions: ctx.permissions };
  }

  async updateProfile(userId: string, dto: UpdateMerchantProfileDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    return this.prisma.merchant.update({
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
        openingTime: dto.openingTime ?? undefined,
        closingTime: dto.closingTime ?? undefined,
        minimumOrderValuePaisa: dto.minimumOrderValuePaisa ?? undefined,
        averagePreparationMinutes: dto.averagePreparationMinutes ?? undefined,
        logoUrl: dto.logoUrl ?? undefined,
        bannerUrl: dto.bannerUrl ?? undefined,
      },
    });
  }

  async setOnline(userId: string, online: boolean) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    await this.prisma.merchant.update({
      where: { id: ctx.merchantId },
      data: { isOnline: online },
    });
    return { ok: true, isOnline: online };
  }

  async setOpen(userId: string, open: boolean) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.STORE);
    await this.prisma.merchant.update({
      where: { id: ctx.merchantId },
      data: { isOpen: open },
    });
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
      this.prisma.order.count({ where: { merchantId, createdAt: { gte: startOfToday } } }),
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
        where: { merchantId, status: OrderStatus.DELIVERED, deliveredAt: { gte: startOfToday } },
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
      where: { merchantId, status: OrderStatus.DELIVERED, deliveredAt: { gte: since } },
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
