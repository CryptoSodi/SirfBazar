import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, OrderStatus, PaymentStatus, RefundStatus, SettlementStatus } from '../common/constants';
import { serializable } from '../common/transaction';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger('Settlements');
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  list(filter: { merchantId?: string; status?: string }) {
    return this.prisma.settlement.findMany({
      where: { ...(filter.merchantId ? { merchantId: filter.merchantId } : {}), ...(filter.status ? { status: filter.status } : {}) },
      include: { merchant: { select: { id: true, shopName: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  private async deductions(tx: Prisma.TransactionClient, orderIds: string[]) {
    if (!orderIds.length) return 0;
    const orders = await tx.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, parentOrderId: true } });
    const parents = [...new Set(orders.map((order) => order.parentOrderId).filter((id): id is string => !!id))];
    const refunds = await tx.refund.findMany({ where: { orderId: { in: [...orderIds, ...parents] }, status: RefundStatus.COMPLETED } });
    const wanted = new Set(orderIds);
    let total = 0;
    for (const refund of refunds) {
      if (wanted.has(refund.orderId)) {
        total += refund.amountPaisa;
        continue;
      }
      const audit = await tx.auditLog.findUnique({ where: { id: `refund-allocation:${refund.id}` } });
      if (!audit) throw new ConflictException('Historical parent refund needs reconciliation before settlement');
      let allocations: Array<{ orderId: string; amountPaisa: number }>;
      try { allocations = JSON.parse(audit.newValue ?? '[]'); }
      catch { throw new ConflictException('Parent refund allocation is invalid'); }
      if (!Array.isArray(allocations)) throw new ConflictException('Parent refund allocation is invalid');
      total += allocations.filter((allocation) => wanted.has(allocation.orderId)).reduce((sum, allocation) => sum + allocation.amountPaisa, 0);
    }
    return total;
  }

  async generate(adminUserId: string, input: { merchantId?: string; startDate: string; endDate: string }) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new BadRequestException('Invalid settlement period');
    const merchants = await this.prisma.merchant.findMany({ where: input.merchantId ? { id: input.merchantId } : { approvalStatus: 'APPROVED' }, orderBy: { id: 'asc' } });
    const created: any[] = [];
    for (const merchant of merchants) {
      const settlement = await serializable(this.prisma, async (tx) => {
        const candidates = await tx.order.findMany({ where: {
          merchantId: merchant.id, status: OrderStatus.DELIVERED, channel: 'ONLINE',
          deliveredAt: { gte: start, lte: end }, settlementId: null,
        }, select: { id: true, parentOrderId: true }, orderBy: { id: 'asc' } });
        const eligible: typeof candidates = [];
        for (const candidate of candidates) {
          const payment = await tx.payment.findFirst({ where: { orderId: candidate.parentOrderId ?? candidate.id }, select: { status: true } });
          if (payment && [PaymentStatus.PAID, PaymentStatus.CASH_COLLECTED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED].includes(payment.status as any)) eligible.push(candidate);
        }
        if (!eligible.length) return null;
        const row = await tx.settlement.create({ data: { merchantId: merchant.id, amountPaisa: 0, status: SettlementStatus.PENDING, startDate: start, endDate: end } });
        await tx.order.updateMany({ where: { id: { in: eligible.map((candidate) => candidate.id) }, merchantId: merchant.id, status: OrderStatus.DELIVERED, channel: 'ONLINE', settlementId: null }, data: { settlementId: row.id } });
        const claimed = await tx.order.findMany({ where: { settlementId: row.id }, select: { id: true, merchantEarningPaisa: true } });
        if (!claimed.length) { await tx.settlement.delete({ where: { id: row.id } }); return null; }
        const deductions = await this.deductions(tx, claimed.map((order) => order.id));
        const amountPaisa = claimed.reduce((sum, order) => sum + order.merchantEarningPaisa, 0) - deductions;
        if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0 || amountPaisa > 2_147_483_647) throw new ConflictException('Settlement payable is empty or invalid; reconcile before generating');
        const updated = await tx.settlement.update({ where: { id: row.id }, data: { amountPaisa } });
        await tx.auditLog.create({ data: { userId: adminUserId, role: 'ADMIN', action: 'SETTLEMENT_GENERATED', entityType: 'Settlement', entityId: row.id, newValue: JSON.stringify({ merchantId: merchant.id, amountPaisa, orderIds: claimed.map((order) => order.id), deductions }) } });
        return { ...updated, orderCount: claimed.length, shopName: merchant.shopName };
      });
      if (settlement) created.push(settlement);
    }
    return created;
  }

  async markPaid(adminUserId: string, settlementId: string, paymentReference: string) {
    if (!paymentReference?.trim()) throw new BadRequestException('Payment reference is required');
    const result = await serializable(this.prisma, async (tx) => {
      const settlement = await tx.settlement.findUnique({ where: { id: settlementId }, include: { merchant: { select: { userId: true, shopName: true } }, orders: { select: { id: true, merchantEarningPaisa: true } } } });
      if (!settlement) throw new NotFoundException('Settlement not found');
      if (settlement.status !== SettlementStatus.PENDING || settlement.amountPaisa <= 0 || !settlement.orders.length) throw new ConflictException('Settlement is not payable; review or reconcile it first');
      const payable = settlement.orders.reduce((sum, order) => sum + order.merchantEarningPaisa, 0) - await this.deductions(tx, settlement.orders.map((order) => order.id));
      if (payable !== settlement.amountPaisa) throw new ConflictException('Settlement deductions changed; hold and reconcile before payment');
      const claim = await tx.settlement.updateMany({ where: { id: settlementId, status: SettlementStatus.PENDING, amountPaisa: payable }, data: { status: SettlementStatus.PAID, paidAt: new Date(), paymentReference } });
      if (claim.count !== 1) throw new ConflictException('Settlement status changed');
      await tx.auditLog.create({ data: { userId: adminUserId, role: 'ADMIN', action: 'SETTLEMENT_PAID', entityType: 'Settlement', entityId: settlementId, newValue: JSON.stringify({ paymentReference, amountPaisa: payable }) } });
      return { settlement, updated: await tx.settlement.findUniqueOrThrow({ where: { id: settlementId } }) };
    });
    await this.notifications.notify({ userId: result.settlement.merchant.userId, audience: 'MERCHANT', scopeId: result.settlement.merchantId, title: 'Settlement paid', body: `Rs ${(result.updated.amountPaisa / 100).toFixed(0)} has been paid out to ${result.settlement.merchant.shopName} (ref ${paymentReference}).`, type: NotificationType.SETTLEMENT_UPDATE, referenceId: settlementId })
      .catch((error) => this.logger.warn(`Post-commit settlement notification failed: ${error}`));
    return result.updated;
  }

  async hold(adminUserId: string, settlementId: string, notes?: string) {
    return serializable(this.prisma, async (tx) => {
      const settlement = await tx.settlement.findUnique({ where: { id: settlementId } });
      if (!settlement) throw new NotFoundException('Settlement not found');
      if (![SettlementStatus.PENDING, SettlementStatus.PROCESSING].includes(settlement.status as any)) throw new ConflictException('Only pending settlements can be held');
      const claim = await tx.settlement.updateMany({ where: { id: settlementId, status: settlement.status }, data: { status: SettlementStatus.ON_HOLD, adminNotes: notes ?? settlement.adminNotes } });
      if (claim.count !== 1) throw new ConflictException('Settlement status changed');
      await tx.auditLog.create({ data: { userId: adminUserId, role: 'ADMIN', action: 'SETTLEMENT_HELD', entityType: 'Settlement', entityId: settlementId, newValue: JSON.stringify({ notes }) } });
      return tx.settlement.findUniqueOrThrow({ where: { id: settlementId } });
    });
  }
}
