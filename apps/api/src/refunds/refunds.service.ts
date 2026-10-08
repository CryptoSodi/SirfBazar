import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, PaymentStatus, RefundStatus, SettlementStatus } from '../common/constants';
import { serializable } from '../common/transaction';

const RESERVED = [RefundStatus.APPROVED, RefundStatus.PROCESSING, RefundStatus.COMPLETED];
const COLLECTED = [PaymentStatus.PAID, PaymentStatus.CASH_COLLECTED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED];
const MAX_PAISA = 2_147_483_647;

type Allocation = { orderId: string; amountPaisa: number };

@Injectable()
export class RefundsService {
  private readonly logger = new Logger('Refunds');
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  private async context(tx: Prisma.TransactionClient, orderId: string, customerId: string) {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { children: true } });
    if (!order || order.customerId !== customerId || order.channel !== 'ONLINE') throw new NotFoundException('Order not found');
    const anchorId = order.parentOrderId ?? order.id;
    const anchor = order.parentOrderId ? await tx.order.findUniqueOrThrow({ where: { id: anchorId }, include: { children: true } }) : order;
    const childOrders = anchor.isParent ? [...anchor.children].sort((a, b) => a.id.localeCompare(b.id)) : [anchor];
    const payment = await tx.payment.findFirst({ where: { orderId: anchorId, customerId }, orderBy: { createdAt: 'asc' } });
    if (!payment || !COLLECTED.includes(payment.status as any)) {
      throw new BadRequestException('No collected payment is available to refund');
    }
    const cod = anchor.paymentMethod === 'COD' && payment.status !== PaymentStatus.PAID;
    const collectedChildren = cod
      ? childOrders.filter((child) => child.status === 'DELIVERED' && [PaymentStatus.CASH_COLLECTED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED].includes(child.paymentStatus as any))
      : childOrders;
    const childCaps = new Map(childOrders.map((child) => [child.id, collectedChildren.some((collected) => collected.id === child.id) ? child.totalAmountPaisa : 0]));
    if (anchor.isParent) {
      let delta = payment.amountPaisa - collectedChildren.reduce((sum, child) => sum + child.totalAmountPaisa, 0);
      if (delta > 0 && collectedChildren.length) childCaps.set(collectedChildren[0].id, (childCaps.get(collectedChildren[0].id) ?? 0) + delta);
      else for (const child of collectedChildren) {
        const reduction = Math.min(-delta, childCaps.get(child.id) ?? 0);
        childCaps.set(child.id, (childCaps.get(child.id) ?? 0) - reduction);
        delta += reduction;
        if (delta >= 0) break;
      }
    }
    if (collectedChildren.length === 0 || [...childCaps.values()].reduce((sum, value) => sum + value, 0) !== payment.amountPaisa) {
      throw new ConflictException('Collected payment allocation needs reconciliation before refund');
    }
    return { order, anchor, anchorId, childOrders, childCaps, payment };
  }

  private async allocationsFor(tx: Prisma.TransactionClient, refund: { id: string; orderId: string; amountPaisa: number }, anchorId: string) {
    if (refund.orderId !== anchorId) return [{ orderId: refund.orderId, amountPaisa: refund.amountPaisa }];
    const anchor = await tx.order.findUnique({ where: { id: anchorId }, select: { isParent: true } });
    if (!anchor?.isParent) return [{ orderId: refund.orderId, amountPaisa: refund.amountPaisa }];
    const audit = await tx.auditLog.findUnique({ where: { id: `refund-allocation:${refund.id}` } });
    if (!audit) throw new ConflictException('Historical parent refund needs reconciliation before another refund');
    try {
      const allocations = JSON.parse(audit.newValue ?? '[]') as Allocation[];
      if (!Array.isArray(allocations) || allocations.reduce((sum, row) => sum + row.amountPaisa, 0) !== refund.amountPaisa) throw new Error('allocation');
      return allocations;
    } catch {
      throw new ConflictException('Historical parent refund allocation needs reconciliation');
    }
  }

  private async reserved(tx: Prisma.TransactionClient, anchorId: string, childIds: string[], exceptId?: string) {
    const refunds = await tx.refund.findMany({ where: { orderId: { in: [anchorId, ...childIds] }, status: { in: RESERVED }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    const perChild = new Map(childIds.map((id) => [id, 0]));
    let total = 0;
    for (const refund of refunds) {
      total += refund.amountPaisa;
      for (const allocation of await this.allocationsFor(tx, refund, anchorId)) {
        perChild.set(allocation.orderId, (perChild.get(allocation.orderId) ?? 0) + allocation.amountPaisa);
      }
    }
    return { total, perChild };
  }

  private async allocate(tx: Prisma.TransactionClient, orderId: string, amountPaisa: number, context: Awaited<ReturnType<RefundsService['context']>>, exceptId?: string) {
    const childIds = context.childOrders.map((child) => child.id);
    const prior = await this.reserved(tx, context.anchorId, childIds, exceptId);
    if (!Number.isSafeInteger(amountPaisa) || amountPaisa < 1 || amountPaisa > MAX_PAISA || prior.total + amountPaisa > context.payment.amountPaisa) {
      throw new BadRequestException('Refund exceeds collected payment');
    }
    if (orderId !== context.anchorId || !context.anchor.isParent) {
      const child = context.childOrders.find((row) => row.id === orderId);
      if (!child || (prior.perChild.get(orderId) ?? 0) + amountPaisa > (context.childCaps.get(orderId) ?? 0)) throw new BadRequestException('Refund exceeds this shop order');
      return [{ orderId, amountPaisa }];
    }
    let remaining = amountPaisa;
    const allocations: Allocation[] = [];
    for (const child of context.childOrders) {
      const available = Math.max(0, (context.childCaps.get(child.id) ?? 0) - (prior.perChild.get(child.id) ?? 0));
      const portion = Math.min(remaining, available);
      if (portion > 0) allocations.push({ orderId: child.id, amountPaisa: portion });
      remaining -= portion;
    }
    if (remaining) throw new BadRequestException('Refund exceeds affected shop order values');
    return allocations;
  }

  private async holdSettlements(tx: Prisma.TransactionClient, allocations: Allocation[]) {
    const orders = await tx.order.findMany({ where: { id: { in: allocations.map((row) => row.orderId) } }, select: { settlementId: true } });
    const settlementIds = [...new Set(orders.map((order) => order.settlementId).filter((id): id is string => !!id))].sort();
    for (const id of settlementIds) {
      const settlement = await tx.settlement.findUniqueOrThrow({ where: { id } });
      if (settlement.status === SettlementStatus.PAID) throw new ConflictException('Paid settlement requires manual reconciliation before refund');
      if (settlement.status === SettlementStatus.PENDING || settlement.status === SettlementStatus.PROCESSING) {
        await tx.settlement.updateMany({ where: { id, status: settlement.status }, data: { status: SettlementStatus.ON_HOLD, adminNotes: 'Refund changed this settlement; recalculate before payment' } });
      }
    }
  }

  private async complete(tx: Prisma.TransactionClient, refundId: string, notes?: string, actorUserId?: string) {
    const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { customer: true, order: true } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status === RefundStatus.COMPLETED) return refund;
    if (![RefundStatus.APPROVED, RefundStatus.PROCESSING].includes(refund.status as any)) throw new BadRequestException(`Refund is ${refund.status}, cannot process`);
    const ctx = await this.context(tx, refund.orderId, refund.customerId);
    const allocations = await this.allocationsFor(tx, refund, ctx.anchorId);
    const currentAllocations = await this.allocate(tx, refund.orderId, refund.amountPaisa, ctx, refund.id);
    if (JSON.stringify(allocations) !== JSON.stringify(currentAllocations)) throw new ConflictException('Refund allocation changed. Reapprove after reconciliation.');
    await this.holdSettlements(tx, allocations);
    const claim = await tx.refund.updateMany({ where: { id: refund.id, status: { in: [RefundStatus.APPROVED, RefundStatus.PROCESSING] } }, data: { status: RefundStatus.COMPLETED, completedAt: new Date(), adminNotes: notes ?? refund.adminNotes, paymentReference: `WALLET-${refund.id}` } });
    if (claim.count !== 1) throw new ConflictException('Refund was already processed');
    if (refund.customer.walletBalancePaisa + refund.amountPaisa > MAX_PAISA) throw new BadRequestException('Wallet balance exceeds supported range');
    await tx.customer.update({ where: { id: refund.customerId }, data: { walletBalancePaisa: { increment: refund.amountPaisa } } });
    const completed = await tx.refund.aggregate({ where: { orderId: { in: [ctx.anchorId, ...ctx.childOrders.map((row) => row.id)] }, status: RefundStatus.COMPLETED }, _sum: { amountPaisa: true } });
    const paymentStatus = (completed._sum.amountPaisa ?? 0) >= ctx.payment.amountPaisa ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    await tx.payment.update({ where: { id: ctx.payment.id }, data: { status: paymentStatus } });
    if (ctx.anchor.isParent) await tx.order.update({ where: { id: ctx.anchorId }, data: { paymentStatus } });
    const completedRefunds = await tx.refund.findMany({ where: { orderId: { in: [ctx.anchorId, ...ctx.childOrders.map((row) => row.id)] }, status: RefundStatus.COMPLETED } });
    const childAmounts = new Map(ctx.childOrders.map((child) => [child.id, 0]));
    for (const row of completedRefunds) {
      for (const allocation of await this.allocationsFor(tx, row, ctx.anchorId)) {
        childAmounts.set(allocation.orderId, (childAmounts.get(allocation.orderId) ?? 0) + allocation.amountPaisa);
      }
    }
    for (const child of ctx.childOrders) {
      const amount = childAmounts.get(child.id) ?? 0;
      if (amount > 0) await tx.order.update({ where: { id: child.id }, data: { paymentStatus: amount >= (ctx.childCaps.get(child.id) ?? 0) ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED } });
    }
    await tx.auditLog.create({ data: { userId: actorUserId ?? refund.customer.userId, role: actorUserId ? 'ADMIN' : 'SYSTEM', action: 'REFUND_COMPLETED', entityType: 'Refund', entityId: refund.id, newValue: JSON.stringify({ amountPaisa: refund.amountPaisa, allocations }) } });
    return tx.refund.findUniqueOrThrow({ where: { id: refund.id }, include: { customer: true, order: true } });
  }

  async create(input: { orderId: string; customerId: string; amountPaisa: number; reason: string; autoApprove?: boolean }) {
    const refund = await serializable(this.prisma, (tx) => this.createInTransaction(tx, input));
    if (input.autoApprove) await this.notifyCompleted(refund as any);
    return refund;
  }

  async createInTransaction(tx: Prisma.TransactionClient, input: { orderId: string; customerId: string; amountPaisa: number; reason: string; autoApprove?: boolean }) {
      const ctx = await this.context(tx, input.orderId, input.customerId);
      const allocations = await this.allocate(tx, input.orderId, input.amountPaisa, ctx);
      if (input.autoApprove) await this.holdSettlements(tx, allocations);
      const created = await tx.refund.create({ data: { orderId: input.orderId, customerId: input.customerId, amountPaisa: input.amountPaisa, reason: input.reason, status: input.autoApprove ? RefundStatus.APPROVED : RefundStatus.REQUESTED }, include: { customer: true, order: true } });
      if (ctx.anchor.isParent && input.orderId === ctx.anchorId) {
        await tx.auditLog.create({ data: { id: `refund-allocation:${created.id}`, role: 'SYSTEM', action: 'REFUND_ALLOCATED', entityType: 'Refund', entityId: created.id, newValue: JSON.stringify(allocations) } });
      }
      return input.autoApprove ? this.complete(tx, created.id, 'Auto-refund on cancellation') : created;
  }

  async approve(refundId: string, adminUserId: string, notes?: string) {
    return serializable(this.prisma, async (tx) => {
      const refund = await tx.refund.findUnique({ where: { id: refundId } });
      if (!refund) throw new NotFoundException('Refund not found');
      if (![RefundStatus.REQUESTED, RefundStatus.UNDER_REVIEW].includes(refund.status as any)) throw new BadRequestException(`Refund is ${refund.status}, cannot approve`);
      const ctx = await this.context(tx, refund.orderId, refund.customerId);
      const allocations = await this.allocate(tx, refund.orderId, refund.amountPaisa, ctx);
      if (ctx.anchor.isParent && refund.orderId === ctx.anchorId) {
        await tx.auditLog.update({ where: { id: `refund-allocation:${refund.id}` }, data: { newValue: JSON.stringify(allocations) } });
      }
      const changed = await tx.refund.updateMany({ where: { id: refundId, status: refund.status }, data: { status: RefundStatus.APPROVED, adminNotes: notes ?? refund.adminNotes } });
      if (changed.count !== 1) throw new ConflictException('Refund changed during review');
      await tx.auditLog.create({ data: { userId: adminUserId, role: 'ADMIN', action: 'REFUND_APPROVED', entityType: 'Refund', entityId: refundId, newValue: JSON.stringify({ notes }) } });
      return tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    });
  }

  async process(refundId: string, adminNotes?: string, actorUserId?: string) {
    const refund = await serializable(this.prisma, (tx) => this.complete(tx, refundId, adminNotes, actorUserId));
    await this.notifyCompleted(refund);
    return refund;
  }

  async notifyCompleted(refund: { customer: { userId: string }; order: { orderNumber: string }; amountPaisa: number; orderId: string }) {
    await this.notifications.notify({ userId: refund.customer.userId, audience: 'CUSTOMER', scopeId: refund.customer.userId, title: 'Refund completed', body: `Rs ${(refund.amountPaisa / 100).toFixed(0)} for order ${refund.order.orderNumber} was credited to your SirfBazar wallet.`, type: NotificationType.REFUND_UPDATE, referenceId: refund.orderId })
      .catch((error) => this.logger.warn(`Post-commit refund notification failed: ${error}`));
  }
}
