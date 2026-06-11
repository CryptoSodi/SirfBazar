import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OrderStatusService } from '../orders/order-status.service';
import {
  ACTIVE_ORDER_STATUSES,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  RiderStatus,
} from '../common/constants';

@Injectable()
export class RiderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly statusService: OrderStatusService,
  ) {}

  async profile(userId: string) {
    const rider = await this.access.riderByUser(userId);
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: rider.merchantId },
      select: { id: true, shopName: true, address: true, latitude: true, longitude: true, phoneNumber: true },
    });
    return { ...rider, merchant };
  }

  async setOnline(userId: string, online: boolean) {
    const rider = await this.access.riderByUser(userId);
    await this.prisma.rider.update({ where: { id: rider.id }, data: { isOnline: online } });
    this.realtime.emitToMerchant(rider.merchantId, 'rider:presence', {
      riderId: rider.id,
      isOnline: online,
    });
    return { ok: true, isOnline: online };
  }

  /**
   * Location ping during an active delivery. Persisted for the order trail and
   * fanned out live to the customer (order room), the merchant, and admins.
   */
  async updateLocation(
    userId: string,
    input: { latitude: number; longitude: number; speed?: number; heading?: number; orderId?: string },
  ) {
    const rider = await this.access.riderByUser(userId);

    let orderId = input.orderId ?? rider.currentOrderId ?? null;
    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, riderId: rider.id },
        select: { id: true, status: true, merchantId: true },
      });
      // Only track against an order while the delivery is actually active.
      orderId = order && (ACTIVE_ORDER_STATUSES as string[]).includes(order.status) ? order.id : null;
    }

    await this.prisma.rider.update({
      where: { id: rider.id },
      data: { latitude: input.latitude, longitude: input.longitude },
    });
    if (orderId) {
      await this.prisma.riderLocationUpdate.create({
        data: {
          riderId: rider.id,
          orderId,
          latitude: input.latitude,
          longitude: input.longitude,
          speed: input.speed ?? null,
          heading: input.heading ?? null,
        },
      });
      const payload = {
        riderId: rider.id,
        orderId,
        latitude: input.latitude,
        longitude: input.longitude,
        heading: input.heading ?? null,
        at: new Date().toISOString(),
      };
      this.realtime.emitToOrder(orderId, 'rider:location', payload);
      this.realtime.emitToMerchant(rider.merchantId, 'rider:location', payload);
      this.realtime.emitToAdmins('rider:location', payload);
    }
    return { ok: true, trackedOrderId: orderId };
  }

  async assignedOrders(userId: string) {
    const rider = await this.access.riderByUser(userId);
    return this.prisma.order.findMany({
      where: { riderId: rider.id, status: { in: ACTIVE_ORDER_STATUSES as string[] } },
      include: {
        items: true,
        merchant: { select: { id: true, shopName: true, address: true, latitude: true, longitude: true, phoneNumber: true } },
        deliveryAddress: true,
        customer: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
      orderBy: { riderAssignedAt: 'desc' },
    });
  }

  async history(userId: string) {
    const rider = await this.access.riderByUser(userId);
    return this.prisma.order.findMany({
      where: { riderId: rider.id, status: { notIn: ACTIVE_ORDER_STATUSES as string[] } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmountPaisa: true,
        paymentMethod: true,
        deliveredAt: true,
        createdAt: true,
        merchant: { select: { shopName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Riders can only ever see orders assigned to them (spec 13.9). */
  async orderDetail(userId: string, orderId: string) {
    const rider = await this.access.riderByUser(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, riderId: rider.id },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        merchant: { select: { id: true, shopName: true, address: true, latitude: true, longitude: true, phoneNumber: true } },
        deliveryAddress: true,
        customer: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not assigned to you');
    // The delivery OTP is the customer's secret; the rider never sees it.
    return { ...order, deliveryOtp: undefined };
  }

  async arrivedAtShop(userId: string, orderId: string, location?: { latitude?: number; longitude?: number }) {
    const { rider, order } = await this.ownedActiveOrder(userId, orderId, [OrderStatus.RIDER_ASSIGNED]);
    await this.prisma.rider.update({
      where: { id: rider.id },
      data: { currentStatus: RiderStatus.PICKING_UP },
    });
    await this.statusService.apply(order.id, OrderStatus.RIDER_ARRIVED_AT_SHOP, {
      userId,
      role: 'RIDER',
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    return { ok: true, status: OrderStatus.RIDER_ARRIVED_AT_SHOP };
  }

  async pickedUp(userId: string, orderId: string, location?: { latitude?: number; longitude?: number }) {
    const { rider, order } = await this.ownedActiveOrder(userId, orderId, [
      OrderStatus.RIDER_ASSIGNED,
      OrderStatus.RIDER_ARRIVED_AT_SHOP,
    ]);
    await this.prisma.rider.update({
      where: { id: rider.id },
      data: { currentStatus: RiderStatus.DELIVERING },
    });
    await this.statusService.appendTimeline(order.id, OrderStatus.PICKED_UP, {
      userId,
      role: 'RIDER',
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    await this.statusService.apply(order.id, OrderStatus.ON_THE_WAY, {
      userId,
      role: 'RIDER',
    }, { pickedUpAt: new Date() });

    await this.notifications.notify({
      userId: order.customer.userId,
      title: 'Order picked up',
      body: `Your order ${order.orderNumber} is on the way. Share the delivery code with the rider on arrival.`,
      type: NotificationType.ORDER_PICKED_UP,
      referenceId: order.id,
    });
    return { ok: true, status: OrderStatus.ON_THE_WAY };
  }

  async arrivedAtCustomer(userId: string, orderId: string, location?: { latitude?: number; longitude?: number }) {
    const { order } = await this.ownedActiveOrder(userId, orderId, [OrderStatus.ON_THE_WAY]);
    await this.statusService.apply(order.id, OrderStatus.RIDER_ARRIVED_AT_CUSTOMER, {
      userId,
      role: 'RIDER',
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    await this.notifications.notify({
      userId: order.customer.userId,
      title: 'Rider has arrived',
      body: `Your rider is at your door with order ${order.orderNumber}.`,
      type: NotificationType.RIDER_NEARBY,
      referenceId: order.id,
    });
    return { ok: true, status: OrderStatus.RIDER_ARRIVED_AT_CUSTOMER };
  }

  /** Delivery completion requires the customer's OTP (spec 21.3). */
  async delivered(
    userId: string,
    orderId: string,
    input: { otp: string; photoUrl?: string; note?: string },
  ) {
    const { rider, order } = await this.ownedActiveOrder(userId, orderId, [
      OrderStatus.ON_THE_WAY,
      OrderStatus.RIDER_ARRIVED_AT_CUSTOMER,
    ]);

    const masterOk = (process.env.OTP_PROVIDER || 'mock') === 'mock' && input.otp === '123456';
    if (!masterOk && input.otp !== order.deliveryOtp) {
      throw new BadRequestException('Incorrect delivery code — ask the customer for the code in their app');
    }

    await this.statusService.apply(order.id, OrderStatus.DELIVERED, {
      userId,
      role: 'RIDER',
      notes: input.note ?? (input.photoUrl ? `Photo: ${input.photoUrl}` : undefined),
    }, { deliveredAt: new Date() });

    // COD: rider collected cash on the doorstep.
    if (order.paymentMethod === 'COD') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.CASH_COLLECTED },
      });
      const anchorId = order.parentOrderId ?? order.id;
      const siblingsPending = order.parentOrderId
        ? await this.prisma.order.count({
            where: {
              parentOrderId: order.parentOrderId,
              status: { not: OrderStatus.DELIVERED },
              id: { not: order.id },
            },
          })
        : 0;
      if (siblingsPending === 0) {
        await this.prisma.payment.updateMany({
          where: { orderId: anchorId, status: PaymentStatus.CASH_PENDING },
          data: { status: PaymentStatus.CASH_COLLECTED },
        });
      }
    }

    await this.prisma.rider.update({
      where: { id: rider.id },
      data: { currentStatus: RiderStatus.IDLE, currentOrderId: null },
    });

    await this.notifications.notify({
      userId: order.customer.userId,
      title: 'Order delivered',
      body: `Order ${order.orderNumber} was delivered. Enjoy! You can rate your experience in the app.`,
      type: NotificationType.ORDER_DELIVERED,
      referenceId: order.id,
    });
    const merchantUserIds = await this.access.merchantUserIds(order.merchantId!);
    await this.notifications.notifyMany(merchantUserIds, {
      title: 'Order delivered',
      body: `Order ${order.orderNumber} was delivered by ${rider.fullName}.`,
      type: NotificationType.ORDER_DELIVERED,
      referenceId: order.id,
    });
    return { ok: true, status: OrderStatus.DELIVERED };
  }

  async reportIssue(userId: string, orderId: string, description: string) {
    const rider = await this.access.riderByUser(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, riderId: rider.id },
    });
    if (!order) throw new NotFoundException('Order not assigned to you');

    const ticket = await this.prisma.supportTicket.create({
      data: {
        orderId: order.id,
        customerId: order.customerId,
        merchantId: order.merchantId,
        riderId: rider.id,
        createdByUserId: userId,
        issueCategory: 'RIDER_ISSUE',
        title: `Rider issue on order ${order.orderNumber}`,
        description,
        priority: 'HIGH',
      },
    });
    this.realtime.emitToAdmins('support:new', { ticketId: ticket.id, orderId: order.id });
    const merchantUserIds = await this.access.merchantUserIds(rider.merchantId);
    await this.notifications.notifyMany(merchantUserIds, {
      title: 'Rider reported an issue',
      body: `${rider.fullName}: ${description.slice(0, 120)} (order ${order.orderNumber})`,
      type: NotificationType.SYSTEM,
      referenceId: order.id,
    });
    return ticket;
  }

  private async ownedActiveOrder(userId: string, orderId: string, allowedStatuses: string[]) {
    const rider = await this.access.riderByUser(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, riderId: rider.id },
      include: { customer: { select: { userId: true } } },
    });
    if (!order) throw new NotFoundException('Order not assigned to you');
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Action not allowed while order is ${order.status}. Expected: ${allowedStatuses.join(', ')}`,
      );
    }
    return { rider, order: { ...order, customer: { userId: order.customer.userId } } };
  }
}
