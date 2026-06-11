import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CANCELLED_ORDER_STATUSES, OrderStatus } from '../common/constants';

export interface StatusChangeBy {
  userId?: string;
  role?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

const TERMINAL: string[] = [OrderStatus.DELIVERED, ...CANCELLED_ORDER_STATUSES];

/**
 * Single write path for order status: updates the row, appends the timeline
 * entry (spec 20.3), pushes realtime events, and rolls aggregate status up to
 * the parent order for multi-merchant checkouts.
 */
@Injectable()
export class OrderStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async apply(
    orderId: string,
    status: OrderStatus,
    by: StatusChangeBy,
    extraFields: Record<string, unknown> = {},
  ) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status, ...extraFields },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        parentOrderId: true,
        merchantId: true,
        riderId: true,
        customer: { select: { userId: true } },
      },
    });

    await this.prisma.orderTimelineEntry.create({
      data: {
        orderId,
        status,
        changedByUserId: by.userId ?? null,
        changedByRole: by.role ?? null,
        notes: by.notes ?? null,
        latitude: by.latitude ?? null,
        longitude: by.longitude ?? null,
      },
    });

    this.broadcast(order, status);
    if (order.parentOrderId && TERMINAL.includes(status)) {
      await this.rollUpParent(order.parentOrderId, by);
    }
    return order;
  }

  /** Timeline entry without changing status (e.g. PICKED_UP before ON_THE_WAY). */
  async appendTimeline(orderId: string, status: string, by: StatusChangeBy) {
    await this.prisma.orderTimelineEntry.create({
      data: {
        orderId,
        status,
        changedByUserId: by.userId ?? null,
        changedByRole: by.role ?? null,
        notes: by.notes ?? null,
        latitude: by.latitude ?? null,
        longitude: by.longitude ?? null,
      },
    });
  }

  private broadcast(
    order: {
      id: string;
      orderNumber: string;
      status: string;
      parentOrderId: string | null;
      merchantId: string | null;
      riderId: string | null;
      customer: { userId: string } | null;
    },
    status: string,
  ) {
    const payload = {
      orderId: order.id,
      parentOrderId: order.parentOrderId,
      orderNumber: order.orderNumber,
      status,
      at: new Date().toISOString(),
    };
    this.realtime.emitToOrder(order.id, 'order:update', payload);
    if (order.parentOrderId) this.realtime.emitToOrder(order.parentOrderId, 'order:update', payload);
    if (order.merchantId) this.realtime.emitToMerchant(order.merchantId, 'order:update', payload);
    if (order.riderId) this.realtime.emitToRider(order.riderId, 'order:update', payload);
    if (order.customer) this.realtime.emitToUser(order.customer.userId, 'order:update', payload);
    this.realtime.emitToAdmins('order:update', payload);
  }

  private async rollUpParent(parentOrderId: string, by: StatusChangeBy) {
    const children = await this.prisma.order.findMany({
      where: { parentOrderId },
      select: { status: true },
    });
    if (children.length === 0) return;
    const allTerminal = children.every((c) => TERMINAL.includes(c.status));
    if (!allTerminal) return;

    const anyDelivered = children.some((c) => c.status === OrderStatus.DELIVERED);
    const parentStatus = anyDelivered ? OrderStatus.DELIVERED : OrderStatus.CANCELLED_BY_MERCHANT;

    const parent = await this.prisma.order.update({
      where: { id: parentOrderId },
      data: {
        status: parentStatus,
        ...(anyDelivered ? { deliveredAt: new Date() } : { cancelledAt: new Date() }),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        parentOrderId: true,
        merchantId: true,
        riderId: true,
        customer: { select: { userId: true } },
      },
    });
    await this.prisma.orderTimelineEntry.create({
      data: {
        orderId: parentOrderId,
        status: parentStatus,
        changedByUserId: by.userId ?? null,
        changedByRole: 'SYSTEM',
        notes: 'All shop orders completed',
      },
    });
    this.broadcast(parent, parentStatus);
  }
}
