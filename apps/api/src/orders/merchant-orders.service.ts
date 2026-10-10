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
import { createHash, randomUUID } from 'node:crypto';

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
    const detail = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        deliveryAddress: true,
        rider: true,
        customer: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
    });
    if (!detail) throw new NotFoundException('Order not found for your shop');
    const orderRevisions = await this.prisma.orderRevision.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, originalTotalPaisa: true, proposedTotalPaisa: true, payload: true, createdAt: true, expiresAt: true, resolvedAt: true },
    });
    return { ...detail, orderRevisions, pendingRevision: orderRevisions.find((revision) => revision.status === 'PENDING') ?? null };
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
      if (tx.orderRevision?.findFirst && await tx.orderRevision.findFirst({ where: { orderId: order.id, status: 'PENDING' }, select: { id: true } })) {
        throw new ConflictException('A rider cannot be assigned while a customer revision is awaiting approval.');
      }
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

  async proposeUnavailable(userId: string, orderId: string, itemId: string, replacementMerchantProductId?: string) {
    const action = replacementMerchantProductId ? 'REPLACE' : 'REMOVE';
    return this.createRevision(userId, orderId, randomUUID(), [{
      originalItemId: itemId,
      action,
      ...(replacementMerchantProductId ? { replacementMerchantProductId } : {}),
    }]);
  }

  async createRevision(
    userId: string,
    orderId: string,
    requestId: string,
    changes: Array<{ originalItemId: string; action: 'REMOVE' | 'REDUCE' | 'REPLACE'; quantity?: number; replacementMerchantProductId?: string }>,
  ) {
    const { ctx } = await this.ownedOrder(userId, orderId);
    if (!changes.length || changes.length > 100 || new Set(changes.map((change) => change.originalItemId)).size !== changes.length) {
      throw new BadRequestException('Choose one to 100 distinct order items to revise.');
    }
    const fingerprint = createHash('sha256').update(JSON.stringify([...changes].sort((a, b) => a.originalItemId.localeCompare(b.originalItemId)))).digest('hex');
    let result: any;
    try {
      result = await serializable(this.prisma, async (tx) => {
      const replay = await tx.orderRevision.findUnique({ where: { requestId } });
      if (replay) {
        const payload = replay.payload as any;
        if (replay.orderId !== orderId || replay.createdByUserId !== userId || payload?.requestHash !== fingerprint) {
          throw new ConflictException('Revision reference is already in use. Refresh the order.');
        }
        return { revision: replay, customerUserId: undefined, orderNumber: undefined };
      }

      const order = await tx.order.findFirst({
        where: { id: orderId, merchantId: ctx.merchantId, channel: 'ONLINE' },
        include: { items: true, parent: true, customer: { select: { userId: true } } },
      });
      if (!order) throw new NotFoundException('Order not found for your shop');
      if (!order.merchantId) throw new ConflictException('Parent orders cannot be revised directly.');
      if (order.paymentMethod !== 'COD') throw new BadRequestException('Order revisions currently support cash on delivery only. Digital payment adjustment is unavailable.');
      const revisionStatuses: string[] = [OrderStatus.SENT_TO_MERCHANT, OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING];
      if (order.status === OrderStatus.READY_FOR_PICKUP || order.riderId || !revisionStatuses.includes(order.status)) {
        throw new ConflictException('This order can no longer be revised before fulfillment.');
      }
      if (order.couponCode || order.discountAmountPaisa > 0 || order.parent?.couponCode || (order.parent?.discountAmountPaisa ?? 0) > 0) {
        throw new BadRequestException('This order has a coupon or discount that cannot yet be safely recalculated after an item revision.');
      }
      if (order.items.some((item) => !['CONFIRMED', 'REPLACED', 'REMOVED'].includes(item.itemStatus))) {
        throw new ConflictException('Resolve the existing item request before proposing another revision.');
      }
      const existingPending = await tx.orderRevision.findFirst({ where: { orderId, status: 'PENDING' } });
      if (existingPending) throw new ConflictException('A revision is already waiting for customer approval.');

      const activeItems = order.items.filter((item) => item.itemStatus === 'CONFIRMED');
      const byId = new Map(activeItems.map((item) => [item.id, item]));
      const changeSnapshots: any[] = [];
      for (const change of changes) {
        const original = byId.get(change.originalItemId);
        if (!original) throw new BadRequestException('One selected order item is no longer available for revision.');
        if (change.action === 'REMOVE') {
          if (change.quantity !== undefined || change.replacementMerchantProductId) throw new BadRequestException('Remove a line without quantity or replacement fields.');
          changeSnapshots.push({ originalItemId: original.id, action: 'REMOVE', original: this.itemSnapshot(original), proposed: null });
          continue;
        }
        const quantity = change.quantity ?? original.quantity;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > original.quantity) throw new BadRequestException('Revised quantities must be positive and cannot exceed the confirmed quantity.');
        if (change.action === 'REDUCE') {
          if (quantity >= original.quantity || change.replacementMerchantProductId) throw new BadRequestException('A quantity change must reduce the existing line without a replacement.');
          changeSnapshots.push({ originalItemId: original.id, action: 'REDUCE', original: this.itemSnapshot(original), proposed: { quantity, unitPricePaisa: original.unitPricePaisa, totalPricePaisa: original.unitPricePaisa * quantity } });
          continue;
        }
        if (!change.replacementMerchantProductId) throw new BadRequestException('Choose a replacement product for this line.');
        const replacement = await tx.merchantProduct.findFirst({ where: { id: change.replacementMerchantProductId, merchantId: ctx.merchantId, isAvailable: true }, include: { product: { include: { category: true } } } });
        if (!replacement || replacement.id === original.merchantProductId || replacement.stockQuantity < quantity || replacement.product.approvalStatus !== 'APPROVED' || replacement.product.isRestricted || replacement.product.requiresPrescription || replacement.product.category.isRestricted || !replacement.product.category.isActive) {
          throw new BadRequestException('The proposed replacement is unavailable or does not have enough stock.');
        }
        const unitPricePaisa = replacement.discountPricePaisa ?? replacement.pricePaisa;
        const totalPricePaisa = unitPricePaisa * quantity;
        if (!Number.isSafeInteger(totalPricePaisa) || unitPricePaisa < 0 || totalPricePaisa > 2147483647) throw new BadRequestException('Replacement price exceeds the supported order amount.');
        changeSnapshots.push({
          originalItemId: original.id,
          action: 'REPLACE',
          original: this.itemSnapshot(original),
          proposed: { merchantProductId: replacement.id, productId: replacement.productId, name: replacement.product.name, imageUrl: replacement.product.imageUrl, unit: replacement.product.unit, quantity, unitPricePaisa, pricePaisa: replacement.pricePaisa, discountPricePaisa: replacement.discountPricePaisa, totalPricePaisa },
        });
      }

      const remainingItems = activeItems.filter((item) => {
        const change = changeSnapshots.find((entry) => entry.originalItemId === item.id);
        return !change || (change.action !== 'REMOVE' && Number(change.proposed?.quantity) > 0);
      });
      if (remainingItems.length === 0) throw new BadRequestException('An order revision must leave at least one product in the order.');

      const proposedSubtotalPaisa = activeItems.reduce((sum, item) => {
        const change = changeSnapshots.find((entry) => entry.originalItemId === item.id);
        return sum + (change ? change.proposed?.totalPricePaisa ?? 0 : item.totalPricePaisa);
      }, 0);
      if (!Number.isSafeInteger(proposedSubtotalPaisa) || proposedSubtotalPaisa > 2147483647) throw new BadRequestException('Revised subtotal exceeds the supported order amount.');
      const singleShopFee = order.parentOrderId ? 0 : this.orders.smallOrderFeeForSubtotal(proposedSubtotalPaisa);
      const proposedTotalPaisa = Math.max(0, proposedSubtotalPaisa + order.deliveryFeePaisa + order.serviceFeePaisa + singleShopFee - order.discountAmountPaisa);
      const parentSnapshot = order.parentOrderId ? await tx.order.findUnique({ where: { id: order.parentOrderId } }) : null;
      let proposedParentTotalPaisa: number | null = null;
      if (parentSnapshot) {
        const siblings = await tx.order.findMany({ where: { parentOrderId: parentSnapshot.id } });
        const subtotal = siblings.reduce((sum, sibling) => sum + (sibling.id === order.id ? proposedSubtotalPaisa : sibling.subtotalPaisa), 0);
        const smallFee = this.orders.smallOrderFeeForSubtotal(subtotal);
        proposedParentTotalPaisa = Math.max(0, subtotal + siblings.reduce((sum, sibling) => sum + sibling.deliveryFeePaisa, 0) + parentSnapshot.serviceFeePaisa + smallFee - parentSnapshot.discountAmountPaisa);
      }
      const configuredMinutes = Number(process.env.ORDER_REVISION_APPROVAL_MINUTES || 30);
      const minutes = Number.isFinite(configuredMinutes) ? Math.max(1, Math.min(24 * 60, Math.floor(configuredMinutes))) : 30;
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + minutes * 60_000);
      const revision = await tx.orderRevision.create({
        data: {
          orderId,
          requestId,
          createdByUserId: userId,
          originalTotalPaisa: order.totalAmountPaisa,
          proposedTotalPaisa,
          expiresAt,
          payload: { requestHash: fingerprint, changes: changeSnapshots, originalSubtotalPaisa: order.subtotalPaisa, proposedSubtotalPaisa, originalParentTotalPaisa: parentSnapshot?.totalAmountPaisa ?? null, proposedParentTotalPaisa },
        },
      });
      await this.statusService.appendTimeline(orderId, 'ORDER_REVISION_PROPOSED', { userId, role: 'MERCHANT', notes: `Customer approval requested: ${order.totalAmountPaisa} to ${proposedTotalPaisa} paisa; expires ${expiresAt.toISOString()}` }, tx);
      return { revision, customerUserId: order.customer.userId, orderNumber: order.orderNumber };
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const replay = await this.prisma.orderRevision.findUnique({ where: { requestId } });
      if (replay) {
        const payload = replay.payload as any;
        if (replay.orderId !== orderId || replay.createdByUserId !== userId || payload?.requestHash !== fingerprint) {
          throw new ConflictException('Revision reference is already in use. Refresh the order.');
        }
        return replay;
      }
      const pending = await this.prisma.orderRevision.findFirst({ where: { orderId, status: 'PENDING' } });
      if (pending) throw new ConflictException('A revision is already waiting for customer approval.');
      throw error;
    }
    if (result.customerUserId) {
      await this.notifications.notify({
        userId: result.customerUserId,
        audience: 'CUSTOMER',
        scopeId: result.customerUserId,
        title: 'Order revision needs your approval',
        body: `The shop proposed changes to order ${result.orderNumber}. Review them within ${Math.max(1, Math.ceil((result.revision.expiresAt.getTime() - result.revision.createdAt.getTime()) / 60_000))} minutes; nothing changes until you approve.`,
        type: NotificationType.REPLACEMENT_REQUESTED,
        referenceId: orderId,
      }).catch((error) => this.logger.warn(`Post-commit revision notification failed: ${error}`));
    }
    return result.revision;
  }

  private itemSnapshot(item: { id: string; productId: string; merchantProductId: string; productNameSnapshot: string; productImageSnapshot: string | null; unitSnapshot: string | null; quantity: number; unitPricePaisa: number; totalPricePaisa: number }) {
    return { id: item.id, productId: item.productId, merchantProductId: item.merchantProductId, name: item.productNameSnapshot, imageUrl: item.productImageSnapshot, unit: item.unitSnapshot, quantity: item.quantity, unitPricePaisa: item.unitPricePaisa, totalPricePaisa: item.totalPricePaisa };
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
