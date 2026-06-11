import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, OrderStatus, RefundStatus, SettlementStatus } from '../common/constants';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list(filter: { merchantId?: string; status?: string }) {
    return this.prisma.settlement.findMany({
      where: {
        ...(filter.merchantId ? { merchantId: filter.merchantId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      include: { merchant: { select: { id: true, shopName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Spec 24.1: settlement = delivered sales earnings − refund deductions.
   * Picks up DELIVERED orders in the period not yet covered by a settlement,
   * stamps them with the new settlement id so they are never double-paid.
   */
  async generate(adminUserId: string, input: { merchantId?: string; startDate: string; endDate: string }) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('Invalid settlement period');
    }

    const merchants = input.merchantId
      ? await this.prisma.merchant.findMany({ where: { id: input.merchantId } })
      : await this.prisma.merchant.findMany({ where: { approvalStatus: 'APPROVED' } });

    const created: any[] = [];
    for (const merchant of merchants) {
      const orders = await this.prisma.order.findMany({
        where: {
          merchantId: merchant.id,
          status: OrderStatus.DELIVERED,
          deliveredAt: { gte: start, lte: end },
          settlementId: null,
        },
        select: { id: true, merchantEarningPaisa: true },
      });
      if (orders.length === 0) continue;

      const refunds = await this.prisma.refund.aggregate({
        where: {
          status: RefundStatus.COMPLETED,
          orderId: { in: orders.map((o) => o.id) },
        },
        _sum: { amountPaisa: true },
      });

      const amountPaisa =
        orders.reduce((s, o) => s + o.merchantEarningPaisa, 0) - (refunds._sum.amountPaisa ?? 0);

      const settlement = await this.prisma.$transaction(async (tx) => {
        const row = await tx.settlement.create({
          data: {
            merchantId: merchant.id,
            amountPaisa,
            status: SettlementStatus.PENDING,
            startDate: start,
            endDate: end,
          },
        });
        await tx.order.updateMany({
          where: { id: { in: orders.map((o) => o.id) } },
          data: { settlementId: row.id },
        });
        return row;
      });

      await this.audit.log({
        userId: adminUserId,
        action: 'SETTLEMENT_GENERATED',
        entityType: 'Settlement',
        entityId: settlement.id,
        newValue: { merchantId: merchant.id, amountPaisa, orders: orders.length },
      });
      created.push({ ...settlement, orderCount: orders.length, shopName: merchant.shopName });
    }
    return created;
  }

  async markPaid(adminUserId: string, settlementId: string, paymentReference: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { merchant: { select: { userId: true, shopName: true } } },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status === SettlementStatus.PAID) {
      throw new BadRequestException('Settlement is already paid');
    }

    const updated = await this.prisma.settlement.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.PAID, paidAt: new Date(), paymentReference },
    });
    await this.notifications.notify({
      userId: settlement.merchant.userId,
      title: 'Settlement paid',
      body: `Rs ${(settlement.amountPaisa / 100).toFixed(0)} has been paid out to ${settlement.merchant.shopName} (ref ${paymentReference}).`,
      type: NotificationType.SETTLEMENT_UPDATE,
      referenceId: settlementId,
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'SETTLEMENT_PAID',
      entityType: 'Settlement',
      entityId: settlementId,
      newValue: { paymentReference, amountPaisa: settlement.amountPaisa },
    });
    return updated;
  }

  async hold(adminUserId: string, settlementId: string, notes?: string) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status === SettlementStatus.PAID) {
      throw new BadRequestException('Cannot hold a paid settlement');
    }
    const updated = await this.prisma.settlement.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.ON_HOLD, adminNotes: notes ?? settlement.adminNotes },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'SETTLEMENT_HELD',
      entityType: 'Settlement',
      entityId: settlementId,
      newValue: { notes },
    });
    return updated;
  }
}
