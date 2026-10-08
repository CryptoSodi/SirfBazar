import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CANCELLED_ORDER_STATUSES, OrderStatus, PaymentStatus } from '../common/constants';
import { serializable } from '../common/transaction';

export interface StatusChangeBy {
  userId?: string;
  role?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

const TERMINAL: string[] = [OrderStatus.DELIVERED, ...CANCELLED_ORDER_STATUSES];

@Injectable()
export class OrderStatusService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeService) {}

  async apply(orderId: string, status: OrderStatus, by: StatusChangeBy, extraFields: Record<string, unknown> = {}, expected?: string[]) {
    const result = await serializable(this.prisma, (tx) => this.applyInTransaction(tx, orderId, status, by, extraFields, expected));
    this.broadcastStatus(result);
    return result.order;
  }

  /** Call inside the writer's transaction when status and stock/money must commit together. */
  async applyInTransaction(tx: Prisma.TransactionClient, orderId: string, status: OrderStatus, by: StatusChangeBy, extraFields: Record<string, unknown> = {}, expected?: string[]) {
    const before = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, parentOrderId: true } });
    if (!before) throw new NotFoundException('Order not found');
    if (TERMINAL.includes(before.status) || (expected && !expected.includes(before.status))) {
      throw new ConflictException('Order status changed. Refresh before continuing.');
    }
    const claimed = await tx.order.updateMany({ where: { id: orderId, status: before.status }, data: { status, ...extraFields } });
    if (claimed.count !== 1) throw new ConflictException('Order status changed. Refresh before continuing.');
    await this.appendTimeline(orderId, status, by, tx);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: {
      id: true, orderNumber: true, status: true, parentOrderId: true, merchantId: true, riderId: true,
      customer: { select: { userId: true } },
    } });
    const parent = before.parentOrderId && TERMINAL.includes(status)
      ? await this.rollUpParent(tx, before.parentOrderId, by)
      : null;
    return { order, parent };
  }

  async appendTimeline(orderId: string, status: string, by: StatusChangeBy, tx: Prisma.TransactionClient = this.prisma) {
    await tx.orderTimelineEntry.create({ data: {
      orderId, status,
      changedByUserId: by.userId ?? null, changedByRole: by.role ?? null,
      notes: by.notes ?? null, latitude: by.latitude ?? null, longitude: by.longitude ?? null,
    } });
  }

  broadcastStatus(result: Awaited<ReturnType<OrderStatusService['applyInTransaction']>>) {
    this.broadcast(result.order, result.order.status);
    if (result.parent) this.broadcast(result.parent, result.parent.status);
  }

  private async rollUpParent(tx: Prisma.TransactionClient, parentOrderId: string, by: StatusChangeBy) {
    const children = await tx.order.findMany({ where: { parentOrderId }, select: { status: true, totalAmountPaisa: true } });
    if (!children.length || !children.every((child) => TERMINAL.includes(child.status))) return null;
    const anyDelivered = children.some((child) => child.status === OrderStatus.DELIVERED);
    const parentStatus = anyDelivered ? OrderStatus.DELIVERED
      : children.every((child) => child.status === OrderStatus.CANCELLED_BY_CUSTOMER) ? OrderStatus.CANCELLED_BY_CUSTOMER
      : children.every((child) => child.status === OrderStatus.CANCELLED_BY_ADMIN) ? OrderStatus.CANCELLED_BY_ADMIN
      : OrderStatus.CANCELLED_BY_MERCHANT;
    const current = await tx.order.findUnique({ where: { id: parentOrderId }, select: { status: true, paymentMethod: true, totalAmountPaisa: true } });
    if (!current || TERMINAL.includes(current.status)) return null;
    const cod = current.paymentMethod === 'COD';
    const cancelledPaisa = children.filter((child) => child.status !== OrderStatus.DELIVERED)
      .reduce((sum, child) => sum + child.totalAmountPaisa, 0);
    const collectedPaisa = anyDelivered ? Math.max(0, current.totalAmountPaisa - cancelledPaisa) : 0;
    const claimed = await tx.order.updateMany({ where: { id: parentOrderId, status: current.status }, data: {
      status: parentStatus,
      ...(cod ? { paymentStatus: anyDelivered ? PaymentStatus.CASH_COLLECTED : PaymentStatus.FAILED } : {}),
      ...(anyDelivered ? { deliveredAt: new Date() } : { cancelledAt: new Date() }),
    } });
    if (claimed.count !== 1) throw new ConflictException('Parent order status changed');
    if (cod) {
      // A cancelled sibling is never cash due. Preserve the original order
      // total as history, but record the amount actually collected at the door.
      await tx.payment.updateMany({ where: { orderId: parentOrderId, status: PaymentStatus.CASH_PENDING }, data: {
        status: anyDelivered ? PaymentStatus.CASH_COLLECTED : PaymentStatus.FAILED,
        amountPaisa: collectedPaisa,
      } });
    }
    await this.appendTimeline(parentOrderId, parentStatus, { ...by, role: 'SYSTEM', notes: 'All shop orders completed' }, tx);
    return tx.order.findUniqueOrThrow({ where: { id: parentOrderId }, select: {
      id: true, orderNumber: true, status: true, parentOrderId: true, merchantId: true, riderId: true,
      customer: { select: { userId: true } },
    } });
  }

  private broadcast(order: {
    id: string; orderNumber: string; status: string; parentOrderId: string | null;
    merchantId: string | null; riderId: string | null; customer: { userId: string } | null;
  }, status: string) {
    const payload = { orderId: order.id, parentOrderId: order.parentOrderId, orderNumber: order.orderNumber, status, at: new Date().toISOString() };
    this.realtime.emitToOrder(order.id, 'order:update', payload);
    if (order.parentOrderId) this.realtime.emitToOrder(order.parentOrderId, 'order:update', payload);
    if (order.merchantId) this.realtime.emitToMerchant(order.merchantId, 'order:update', payload);
    if (order.riderId) this.realtime.emitToRider(order.riderId, 'order:update', payload);
    if (order.customer) this.realtime.emitToUser(order.customer.userId, 'order:update', payload);
    this.realtime.emitToAdmins('order:update', payload);
  }
}
