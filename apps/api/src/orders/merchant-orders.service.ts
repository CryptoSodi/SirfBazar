import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OrdersService } from './orders.service';
import { OrderStatusService } from './order-status.service';
import { NotificationType, OrderStatus, RiderStatus, StaffPermission } from '../common/constants';

@Injectable()
export class MerchantOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly orders: OrdersService,
    private readonly statusService: OrderStatusService,
  ) {}

  private async ownedOrder(userId: string, orderId: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.ORDERS);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, merchantId: ctx.merchantId },
      include: { customer: { include: { user: true } }, items: true },
    });
    if (!order) throw new NotFoundException('Order not found for your shop');
    return { ctx, order };
  }

  async list(userId: string, status?: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.ORDERS);
    return this.prisma.order.findMany({
      where: { merchantId: ctx.merchantId, ...(status ? { status } : {}) },
      include: {
        items: true,
        deliveryAddress: true,
        rider: { select: { id: true, fullName: true, phoneNumber: true } },
        customer: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async detail(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    return this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        deliveryAddress: true,
        rider: true,
        customer: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
    });
  }

  async accept(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.SENT_TO_MERCHANT]);
    await this.statusService.apply(order.id, OrderStatus.MERCHANT_ACCEPTED, {
      userId,
      role: 'MERCHANT',
    }, { acceptedAt: new Date() });
    await this.notifications.notify({
      userId: order.customer.user.id,
      title: 'Order accepted',
      body: `${await this.shopName(order.merchantId!)} accepted order ${order.orderNumber} and will start preparing it.`,
      type: NotificationType.ORDER_ACCEPTED,
      referenceId: order.id,
    });
    return { ok: true, status: OrderStatus.MERCHANT_ACCEPTED };
  }

  async reject(userId: string, orderId: string, reason: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.SENT_TO_MERCHANT]);
    await this.orders.restoreStock(order.id);
    await this.statusService.apply(order.id, OrderStatus.MERCHANT_REJECTED, {
      userId,
      role: 'MERCHANT',
      notes: reason,
    }, { cancellationReason: reason, cancelledAt: new Date() });
    await this.notifications.notify({
      userId: order.customer.user.id,
      title: 'Order rejected',
      body: `Order ${order.orderNumber} was rejected by the shop${reason ? `: ${reason}` : ''}. Any payment will be refunded.`,
      type: NotificationType.ORDER_REJECTED,
      referenceId: order.id,
    });
    await this.orders.refundIfPaid(order.parentOrderId ?? order.id, order.customerId, `Merchant rejected: ${reason}`);
    return { ok: true, status: OrderStatus.MERCHANT_REJECTED };
  }

  async markPreparing(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.MERCHANT_ACCEPTED]);
    await this.statusService.apply(order.id, OrderStatus.PREPARING, { userId, role: 'MERCHANT' });
    return { ok: true, status: OrderStatus.PREPARING };
  }

  async markReady(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING]);
    await this.statusService.apply(order.id, OrderStatus.READY_FOR_PICKUP, {
      userId,
      role: 'MERCHANT',
    }, { readyForPickupAt: new Date() });
    return { ok: true, status: OrderStatus.READY_FOR_PICKUP };
  }

  /**
   * Core delivery rule (spec 21.2): a merchant can only assign its OWN riders,
   * and only to its own orders.
   */
  async assignRider(userId: string, orderId: string, riderId: string) {
    const { ctx, order } = await this.ownedOrder(userId, orderId);
    this.access.requirePermission(ctx, StaffPermission.RIDERS);
    this.requireStatus(order.status, [OrderStatus.READY_FOR_PICKUP]);

    const rider = await this.prisma.rider.findFirst({
      where: { id: riderId, merchantId: ctx.merchantId },
    });
    if (!rider) throw new ForbiddenException('This rider does not belong to your shop');
    if (!rider.isActive || rider.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('Rider is not active');
    }

    await this.prisma.rider.update({
      where: { id: rider.id },
      data: { currentStatus: RiderStatus.ASSIGNED, currentOrderId: order.id },
    });
    await this.statusService.apply(order.id, OrderStatus.RIDER_ASSIGNED, {
      userId,
      role: 'MERCHANT',
      notes: `Rider ${rider.fullName}`,
    }, { riderId: rider.id, riderAssignedAt: new Date() });

    await this.notifications.notify({
      userId: rider.userId,
      title: 'New delivery assigned',
      body: `Pick up order ${order.orderNumber} from the shop.`,
      type: NotificationType.RIDER_ASSIGNED,
      referenceId: order.id,
    });
    this.realtime.emitToRider(rider.id, 'delivery:assigned', {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
    await this.notifications.notify({
      userId: order.customer.user.id,
      title: 'Rider assigned',
      body: `${rider.fullName} will deliver order ${order.orderNumber}.`,
      type: NotificationType.RIDER_ASSIGNED,
      referenceId: order.id,
    });
    return { ok: true, status: OrderStatus.RIDER_ASSIGNED, rider: { id: rider.id, fullName: rider.fullName } };
  }

  /** Mark an item unavailable, optionally suggesting a replacement product. */
  async markItemUnavailable(
    userId: string,
    orderId: string,
    itemId: string,
    replacementMerchantProductId?: string,
  ) {
    const { ctx, order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [
      OrderStatus.SENT_TO_MERCHANT,
      OrderStatus.MERCHANT_ACCEPTED,
      OrderStatus.PREPARING,
    ]);
    const item = order.items.find((i) => i.id === itemId && i.itemStatus === 'CONFIRMED');
    if (!item) throw new NotFoundException('Order item not found');

    // Give back the unavailable item's reserved stock.
    await this.prisma.merchantProduct.update({
      where: { id: item.merchantProductId },
      data: { stockQuantity: { increment: item.quantity } },
    }).catch(() => undefined);

    if (!replacementMerchantProductId) {
      await this.prisma.orderItem.update({ where: { id: item.id }, data: { itemStatus: 'UNAVAILABLE' } });
      await this.orders.recomputeOrderTotals(order.id);
      await this.statusService.appendTimeline(order.id, 'ITEM_UNAVAILABLE', {
        userId,
        role: 'MERCHANT',
        notes: item.productNameSnapshot,
      });
      await this.notifications.notify({
        userId: order.customer.user.id,
        title: 'Item unavailable',
        body: `${item.productNameSnapshot} is unavailable for order ${order.orderNumber}; it was removed from your bill.`,
        type: NotificationType.REPLACEMENT_REQUESTED,
        referenceId: order.id,
      });
      return { ok: true, itemStatus: 'UNAVAILABLE' };
    }

    const replacement = await this.prisma.merchantProduct.findFirst({
      where: { id: replacementMerchantProductId, merchantId: ctx.merchantId },
      include: { product: true },
    });
    if (!replacement) throw new NotFoundException('Replacement product not found in your shop');
    if (!replacement.isAvailable || replacement.stockQuantity < item.quantity) {
      throw new BadRequestException('Replacement product has insufficient stock');
    }

    await this.prisma.merchantProduct.update({
      where: { id: replacement.id },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    const unitPrice = replacement.discountPricePaisa ?? replacement.pricePaisa;
    await this.prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: replacement.productId,
        merchantProductId: replacement.id,
        productNameSnapshot: replacement.product.name,
        productImageSnapshot: replacement.product.imageUrl,
        unitSnapshot: replacement.product.unit,
        quantity: item.quantity,
        unitPricePaisa: unitPrice,
        totalPricePaisa: unitPrice * item.quantity,
        itemStatus: 'REPLACEMENT_SUGGESTED',
        replacementForItemId: item.id,
      },
    });
    await this.statusService.appendTimeline(order.id, 'REPLACEMENT_SUGGESTED', {
      userId,
      role: 'MERCHANT',
      notes: `${item.productNameSnapshot} -> ${replacement.product.name}`,
    });
    await this.notifications.notify({
      userId: order.customer.user.id,
      title: 'Replacement suggested',
      body: `The shop suggests ${replacement.product.name} instead of ${item.productNameSnapshot} on order ${order.orderNumber}. Open the order to accept or reject.`,
      type: NotificationType.REPLACEMENT_REQUESTED,
      referenceId: order.id,
    });
    return { ok: true, itemStatus: 'REPLACEMENT_SUGGESTED' };
  }

  private requireStatus(current: string, allowed: string[]) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        `Action not allowed while order is ${current}. Expected: ${allowed.join(', ')}`,
      );
    }
  }

  private async shopName(merchantId: string) {
    const m = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { shopName: true },
    });
    return m?.shopName ?? 'The shop';
  }
}
