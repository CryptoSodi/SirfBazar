import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ACTIVE_ORDER_STATUSES,
  CANCELLED_ORDER_STATUSES,
  MerchantApprovalStatus,
  NotificationType,
  OrderStatus,
  RefundStatus,
  TicketStatus,
} from '../common/constants';
import { parsePage, paged, PageQuery } from '../common/utils/pagination';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async dashboard() {
    const [
      totalCustomers,
      totalMerchants,
      totalRiders,
      totalOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      moneyAgg,
      pendingTickets,
      pendingMerchants,
      pendingRefunds,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.merchant.count(),
      this.prisma.rider.count(),
      this.prisma.order.count({ where: { isParent: false } }),
      this.prisma.order.count({
        where: { isParent: false, status: { in: ACTIVE_ORDER_STATUSES as string[] } },
      }),
      this.prisma.order.count({ where: { isParent: false, status: OrderStatus.DELIVERED } }),
      this.prisma.order.count({
        where: { isParent: false, status: { in: CANCELLED_ORDER_STATUSES as string[] } },
      }),
      this.prisma.order.aggregate({
        where: { isParent: false, status: OrderStatus.DELIVERED },
        _sum: { totalAmountPaisa: true, commissionAmountPaisa: true, deliveryFeePaisa: true },
        _count: true,
      }),
      this.prisma.supportTicket.count({
        where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_REVIEW, TicketStatus.ESCALATED] } },
      }),
      this.prisma.merchant.count({
        where: {
          approvalStatus: {
            in: [MerchantApprovalStatus.SUBMITTED, MerchantApprovalStatus.UNDER_REVIEW],
          },
        },
      }),
      this.prisma.refund.count({
        where: { status: { in: [RefundStatus.REQUESTED, RefundStatus.UNDER_REVIEW] } },
      }),
    ]);

    const gmvPaisa = moneyAgg._sum.totalAmountPaisa ?? 0;
    return {
      totalCustomers,
      totalMerchants,
      totalRiders,
      totalOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      gmvPaisa,
      commissionRevenuePaisa: moneyAgg._sum.commissionAmountPaisa ?? 0,
      deliveryFeeRevenuePaisa: moneyAgg._sum.deliveryFeePaisa ?? 0,
      avgOrderValuePaisa: moneyAgg._count ? Math.round(gmvPaisa / moneyAgg._count) : 0,
      pendingTickets,
      pendingMerchants,
      pendingRefunds,
    };
  }

  async analytics(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
    const toDate = to ? new Date(to) : new Date();

    const delivered = await this.prisma.order.findMany({
      where: {
        isParent: false,
        status: OrderStatus.DELIVERED,
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        createdAt: true,
        deliveredAt: true,
        totalAmountPaisa: true,
        merchantId: true,
        merchant: { select: { shopName: true } },
      },
    });

    const byDay = new Map<string, { orders: number; gmvPaisa: number }>();
    let deliveryMinutesSum = 0;
    let deliveryMinutesCount = 0;
    const byMerchant = new Map<string, { shopName: string; gmvPaisa: number; orders: number }>();
    for (const o of delivered) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const d = byDay.get(day) ?? { orders: 0, gmvPaisa: 0 };
      d.orders++;
      d.gmvPaisa += o.totalAmountPaisa;
      byDay.set(day, d);

      if (o.deliveredAt) {
        deliveryMinutesSum += (o.deliveredAt.getTime() - o.createdAt.getTime()) / 60000;
        deliveryMinutesCount++;
      }
      if (o.merchantId) {
        const m = byMerchant.get(o.merchantId) ?? {
          shopName: o.merchant?.shopName ?? '?',
          gmvPaisa: 0,
          orders: 0,
        };
        m.gmvPaisa += o.totalAmountPaisa;
        m.orders++;
        byMerchant.set(o.merchantId, m);
      }
    }

    const itemsAgg = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productNameSnapshot'],
      where: { createdAt: { gte: fromDate, lte: toDate } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const [allInRange, cancelledInRange] = await Promise.all([
      this.prisma.order.count({
        where: { isParent: false, createdAt: { gte: fromDate, lte: toDate } },
      }),
      this.prisma.order.count({
        where: {
          isParent: false,
          status: { in: CANCELLED_ORDER_STATUSES as string[] },
          createdAt: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    return {
      ordersByDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
      topProducts: itemsAgg.map((i) => ({
        productId: i.productId,
        name: i.productNameSnapshot,
        quantity: i._sum.quantity ?? 0,
      })),
      topMerchants: [...byMerchant.entries()]
        .map(([merchantId, v]) => ({ merchantId, ...v }))
        .sort((a, b) => b.gmvPaisa - a.gmvPaisa)
        .slice(0, 10),
      avgDeliveryMinutes: deliveryMinutesCount
        ? Math.round(deliveryMinutesSum / deliveryMinutesCount)
        : 0,
      cancellationRate: allInRange ? Math.round((cancelledInRange / allInRange) * 1000) / 10 : 0,
    };
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  async listCustomers(query: PageQuery & { q?: string }) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where = {
      role: 'CUSTOMER',
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q } },
              { phoneNumber: { contains: query.q } },
              { email: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          email: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          customer: { select: { id: true, walletBalancePaisa: true, _count: { select: { orders: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async customerDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        customer: {
          include: {
            addresses: true,
            orders: {
              where: { parentOrderId: null },
              select: { id: true, orderNumber: true, status: true, totalAmountPaisa: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return user;
  }

  async setUserStatus(adminUserId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === 'SUSPENDED') {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      userId: adminUserId,
      action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      entityType: 'User',
      entityId: userId,
      oldValue: { status: user.status },
      newValue: { status },
    });
    return { ok: true, status };
  }

  // ── Riders ─────────────────────────────────────────────────────────────────

  async listRiders(query: PageQuery) {
    const { page, pageSize, skip, take } = parsePage(query);
    const [rows, total] = await Promise.all([
      this.prisma.rider.findMany({
        include: { merchant: { select: { id: true, shopName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.rider.count(),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async setRiderSuspended(adminUserId: string, riderId: string, suspended: boolean) {
    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider not found');
    await this.prisma.rider.update({
      where: { id: riderId },
      data: suspended
        ? { approvalStatus: 'SUSPENDED', isActive: false, isOnline: false }
        : { approvalStatus: 'APPROVED', isActive: true },
    });
    await this.notifications.notify({
      userId: rider.userId,
      title: suspended ? 'Account suspended' : 'Account reinstated',
      body: suspended
        ? 'Your rider account has been suspended by SirfBazar. Contact support for details.'
        : 'Your rider account has been reinstated. You can go online again.',
      type: NotificationType.SYSTEM,
    });
    await this.audit.log({
      userId: adminUserId,
      action: suspended ? 'RIDER_SUSPENDED' : 'RIDER_REINSTATED',
      entityType: 'Rider',
      entityId: riderId,
    });
    return { ok: true };
  }

  // ── Audit logs ─────────────────────────────────────────────────────────────

  async listAuditLogs(query: PageQuery & { entityType?: string }) {
    const { page, pageSize, skip, take } = parsePage(query, 50);
    const where = query.entityType ? { entityType: query.entityType } : {};
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }
}
