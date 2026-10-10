import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OrdersService } from './orders.service';
import { OrderStatusService } from './order-status.service';
import { NotificationType, OrderStatus, RiderStatus, StaffPermission } from '../common/constants';
import { PageQuery, paged, parsePage } from '../common/utils/pagination';
import { serializable } from '../common/transaction';

@Injectable()
export class MerchantOrdersService {
  private readonly logger = new Logger(MerchantOrdersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly orders: OrdersService,
    private readonly statusService: OrderStatusService,
  ) {}

  private async afterCommit(effect: () => Promise<unknown>) {
    try { await effect(); }
    catch (error) { this.logger.warn(`Post-commit notification failed: ${error instanceof Error ? error.message : String(error)}`); }
  }

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

  async list(userId: string, query: PageQuery & { status?: string; attention?: string } = {}) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.ORDERS);
    const where = { merchantId: ctx.merchantId, channel: 'ONLINE',
      ...(query.status ? { status: query.status } : query.attention === 'true' ?
        { status: { in: [OrderStatus.SENT_TO_MERCHANT, OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP] } } : {}) };
    const paginationRequested = query.page !== undefined || query.pageSize !== undefined;
    const { page, pageSize, skip, take } = parsePage(query);
    const [rows, total] = await Promise.all([this.prisma.order.findMany({
      // Online marketplace orders only — in-store POS sales live in the POS app.
      where,
      include: {
        items: true,
        deliveryAddress: true,
        rider: { select: { id: true, fullName: true, phoneNumber: true } },
        customer: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: paginationRequested ? skip : 0,
      take: paginationRequested ? take : 100,
    }), this.prisma.order.count({ where })]);
    // Preserve the array response for existing clients; explicit page queries get metadata.
    return paginationRequested ? paged(rows, total, page, pageSize) : rows;
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
    const changed = await serializable(this.prisma, async (tx) => {
      await this.statusService.applyInTransaction(tx, order.id, OrderStatus.MERCHANT_ACCEPTED,
        { userId, role: 'MERCHANT' }, { acceptedAt: new Date() }, [OrderStatus.SENT_TO_MERCHANT]);
      return this.statusService.applyInTransaction(tx, order.id, OrderStatus.PREPARING,
        { userId, role: 'MERCHANT' }, {}, [OrderStatus.MERCHANT_ACCEPTED]);
    });
    this.statusService.broadcastStatus(changed);
    await this.afterCommit(async () => this.notifications.notify({
      userId: order.customer.user.id,
      audience: 'CUSTOMER', scopeId: order.customer.user.id,
      title: 'Order accepted',
      body: `${await this.shopName(order.merchantId!)} is preparing order ${order.orderNumber}.`,
      type: NotificationType.ORDER_ACCEPTED,
      referenceId: order.id,
    }));
    return { ok: true, status: OrderStatus.PREPARING };
  }

  async reject(userId: string, orderId: string, reason: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.SENT_TO_MERCHANT]);
    const { changed, refund } = await serializable(this.prisma, async (tx) => {
      const result = await this.statusService.applyInTransaction(tx, order.id, OrderStatus.MERCHANT_REJECTED, { userId, role: 'MERCHANT', notes: reason }, { cancellationReason: reason, cancelledAt: new Date() }, [OrderStatus.SENT_TO_MERCHANT]);
      await this.orders.restoreStockInTransaction(tx, order.id);
      const refund = await this.orders.refundIfPaidInTransaction(tx, order.id, order.customerId, `Merchant rejected: ${reason}`);
      return { changed: result, refund };
    });
    this.statusService.broadcastStatus(changed);
    await this.notifications.notify({
      userId: order.customer.user.id,
      audience: 'CUSTOMER', scopeId: order.customer.user.id,
      title: 'Order rejected',
      body: `Order ${order.orderNumber} was rejected by the shop${reason ? `: ${reason}` : ''}. Any payment will be refunded.`,
      type: NotificationType.ORDER_REJECTED,
      referenceId: order.id,
    }).catch(() => undefined);
    if (refund) await this.orders.notifyCompletedRefund(refund);
    return { ok: true, status: OrderStatus.MERCHANT_REJECTED };
  }

  async markPreparing(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.MERCHANT_ACCEPTED]);
    await this.statusService.apply(order.id, OrderStatus.PREPARING, { userId, role: 'MERCHANT' }, {}, [OrderStatus.MERCHANT_ACCEPTED]);
    return { ok: true, status: OrderStatus.PREPARING };
  }

  async markReady(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    this.requireStatus(order.status, [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING]);
    const changed = await serializable(this.prisma, async (tx) => {
      // Re-read inside the transaction: readiness can race an early assignment.
      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { riderId: true } });
      const ready = await this.statusService.applyInTransaction(tx, order.id, OrderStatus.READY_FOR_PICKUP,
        { userId, role: 'MERCHANT' }, { readyForPickupAt: new Date() }, [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING]);
      if (!current.riderId) return ready;
      return this.statusService.applyInTransaction(tx, order.id, OrderStatus.RIDER_ASSIGNED,
        { userId, role: 'SYSTEM', notes: 'Packed order ready for the assigned rider' }, {}, [OrderStatus.READY_FOR_PICKUP]);
    });
    this.statusService.broadcastStatus(changed);
    return { ok: true, status: changed.order.status };
  }

  /**
   * Core delivery rule (spec 21.2): a merchant can only assign its OWN riders,
   * and only to its own orders.
   */
  async assignRider(userId: string, orderId: string, riderId: string) {
    const { ctx, order } = await this.ownedOrder(userId, orderId);
    this.access.requirePermission(ctx, StaffPermission.RIDERS);
    const assignableStatuses = [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP];
    this.requireStatus(order.status, assignableStatuses);

    const rider = await this.prisma.rider.findFirst({
      where: { id: riderId, merchantId: ctx.merchantId },
    });
    if (!rider) throw new ForbiddenException('This rider does not belong to your shop');
    if (!rider.isActive || rider.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('Rider is not active');
    }

    const changed = await serializable(this.prisma, async (tx) => {
      const current = await tx.order.findFirst({ where: { id: order.id, merchantId: ctx.merchantId, riderId: null, status: { in: assignableStatuses } }, select: { status: true } });
      if (!current) throw new ConflictException('This order already has a rider or has changed. Refresh the order.');
      const claimed = await tx.rider.updateMany({ where: { id: rider.id, merchantId: ctx.merchantId, isActive: true, approvalStatus: 'APPROVED', currentStatus: RiderStatus.IDLE, currentOrderId: null }, data: { currentStatus: RiderStatus.ASSIGNED, currentOrderId: order.id } });
      if (claimed.count !== 1) throw new BadRequestException('Rider is already assigned or unavailable');
      // Null-rider claim protects an order whose status remains PREPARING.
      const reserved = await tx.order.updateMany({ where: { id: order.id, merchantId: ctx.merchantId, riderId: null, status: current.status }, data: { riderId: rider.id, riderAssignedAt: new Date() } });
      if (reserved.count !== 1) throw new ConflictException('Rider assignment changed. Refresh the order.');
      const next = current.status === OrderStatus.READY_FOR_PICKUP ? OrderStatus.RIDER_ASSIGNED : current.status as OrderStatus;
      return this.statusService.applyInTransaction(tx, order.id, next, { userId, role: 'MERCHANT', notes: `Assigned rider: ${rider.fullName}` }, {}, [current.status]);
    });
    this.statusService.broadcastStatus(changed);

    await this.afterCommit(() => this.notifications.notify({
      userId: rider.userId,
      audience: 'RIDER', scopeId: rider.id,
      title: 'New delivery assigned',
      body: changed.order.status === OrderStatus.RIDER_ASSIGNED ? `Pick up order ${order.orderNumber} from the shop.` : `Order ${order.orderNumber} is assigned to you. Wait for the shop to mark it ready before pickup.`,
      type: NotificationType.RIDER_ASSIGNED,
      referenceId: order.id,
    }));
    this.realtime.emitToRider(rider.id, 'delivery:assigned', {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
    await this.afterCommit(() => this.notifications.notify({
      userId: order.customer.user.id,
      audience: 'CUSTOMER', scopeId: order.customer.user.id,
      title: 'Rider assigned',
      body: `${rider.fullName} will deliver order ${order.orderNumber}.`,
      type: NotificationType.RIDER_ASSIGNED,
      referenceId: order.id,
    }));
    return { ok: true, status: changed.order.status, rider: { id: rider.id, fullName: rider.fullName } };
  }

  /** Mark an item unavailable, optionally suggesting a replacement product. */
  async markItemUnavailable(
    userId: string,
    orderId: string,
    itemId: string,
    replacementMerchantProductId?: string,
  ) {
    const { ctx } = await this.ownedOrder(userId, orderId);
    const result = await serializable(this.prisma, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, merchantId: ctx.merchantId, status: { in: [OrderStatus.SENT_TO_MERCHANT, OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING] } }, include: { customer: { select: { userId: true } } } });
      if (!order) throw new BadRequestException('Order changed. Refresh before editing items.');
      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId, itemStatus: 'CONFIRMED' } });
      if (!item) throw new NotFoundException('Order item is no longer available');
      let replacementName: string | null = null;
      if (replacementMerchantProductId) {
        const replacement = await tx.merchantProduct.findFirst({ where: { id: replacementMerchantProductId, merchantId: ctx.merchantId, isAvailable: true }, include: { product: { include: { category: true } } } });
        if (!replacement || replacement.product.approvalStatus !== 'APPROVED' || replacement.product.isRestricted || replacement.product.requiresPrescription || replacement.product.category.isRestricted) throw new BadRequestException('Replacement product is unavailable');
        if (replacement.id === item.merchantProductId) throw new BadRequestException('Choose a different replacement product');
        const claimed = await tx.merchantProduct.updateMany({ where: { id: replacement.id, stockQuantity: { gte: item.quantity }, isAvailable: true }, data: { stockQuantity: { decrement: item.quantity } } });
        if (claimed.count !== 1) throw new BadRequestException('Replacement product has insufficient stock');
        const unitPrice = replacement.discountPricePaisa ?? replacement.pricePaisa;
        if (!Number.isSafeInteger(unitPrice * item.quantity) || unitPrice < 1) throw new BadRequestException('Replacement price is invalid');
        await tx.orderItem.create({ data: { orderId, productId: replacement.productId, merchantProductId: replacement.id, productNameSnapshot: replacement.product.name, productImageSnapshot: replacement.product.imageUrl, unitSnapshot: replacement.product.unit, quantity: item.quantity, unitPricePaisa: unitPrice, totalPricePaisa: unitPrice * item.quantity, itemStatus: 'REPLACEMENT_SUGGESTED', replacementForItemId: item.id } });
        replacementName = replacement.product.name;
      }
      const changed = await tx.orderItem.updateMany({ where: { id: item.id, itemStatus: 'CONFIRMED' }, data: { itemStatus: 'UNAVAILABLE' } });
      if (changed.count !== 1) throw new BadRequestException('Item changed. Refresh this order.');
      await tx.merchantProduct.update({ where: { id: item.merchantProductId }, data: { stockQuantity: { increment: item.quantity } } });
      await this.orders.recomputeOrderTotals(order.id, tx);
      await this.statusService.appendTimeline(order.id, replacementName ? 'REPLACEMENT_SUGGESTED' : 'ITEM_UNAVAILABLE', { userId, role: 'MERCHANT', notes: replacementName ? `${item.productNameSnapshot} -> ${replacementName}` : item.productNameSnapshot }, tx);
      return { order, item, replacementName };
    });
    await this.notifications.notify({ userId: result.order.customer.userId, audience: 'CUSTOMER', scopeId: result.order.customer.userId, title: result.replacementName ? 'Replacement suggested' : 'Item unavailable', body: result.replacementName ? `The shop suggests ${result.replacementName} instead of ${result.item.productNameSnapshot} on order ${result.order.orderNumber}. Open the order to accept or reject.` : `${result.item.productNameSnapshot} is unavailable for order ${result.order.orderNumber}; it was removed from your bill.`, type: NotificationType.REPLACEMENT_REQUESTED, referenceId: orderId }).catch(() => undefined);
    return { ok: true, itemStatus: result.replacementName ? 'REPLACEMENT_SUGGESTED' : 'UNAVAILABLE' };
  }

  private requireStatus(current: string, allowed: string[]) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        'This action is no longer available. Refresh the order to see its next step.',
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
