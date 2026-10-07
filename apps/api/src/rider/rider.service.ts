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
import { OrderStatusService } from '../orders/order-status.service';
import { serializable } from '../common/transaction';
import { AuthService } from '../auth/auth.service';
import {
  ACTIVE_ORDER_STATUSES,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  RiderStatus,
  UserRole,
} from '../common/constants';

@Injectable()
export class RiderService {
  private readonly logger = new Logger(RiderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly statusService: OrderStatusService,
    private readonly auth: AuthService,
  ) {}

  private async afterCommit(effect: () => Promise<unknown>) {
    try { await effect(); }
    catch (error) { this.logger.warn(`Post-commit notification failed: ${error instanceof Error ? error.message : String(error)}`); }
  }

  // ── Rider self-onboarding (apply to a shop) ─────────────────────────────────

  /** Approved shops a rider can apply to work for. */
  async listShops(q?: string) {
    return this.prisma.merchant.findMany({
      where: {
        approvalStatus: 'APPROVED',
        ...(q ? { shopName: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: { id: true, shopName: true, city: true, area: true, address: true },
      orderBy: { shopName: 'asc' },
      take: 50,
    });
  }

  /** A logged-in user applies to deliver for a shop; pending the shop's approval. */
  async applyAsRider(
    userId: string,
    dto: {
      merchantId: string;
      fullName: string;
      phoneNumber: string;
      vehicleType?: string;
      vehicleNumber?: string;
      profileImageUrl?: string;
    },
  ) {
    const existing = await this.prisma.rider.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('This account is already registered as a rider.');
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: dto.merchantId, approvalStatus: 'APPROVED' },
      select: { id: true, shopName: true },
    });
    if (!merchant) throw new NotFoundException('Shop not found or not accepting riders');

    let rider;
    try {
      rider = await this.prisma.rider.create({
        data: {
          merchantId: merchant.id,
          userId,
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          vehicleType: dto.vehicleType ?? 'MOTORBIKE',
          vehicleNumber: dto.vehicleNumber ?? null,
          profileImageUrl: dto.profileImageUrl ?? null,
          approvalStatus: 'PENDING',
          isActive: false,
        },
      });
    } catch (e: any) {
      // Lost a race with a concurrent apply (or a merchant-created rider row): the
      // userId unique constraint fired. Surface the friendly 400, not a raw 500.
      if (e?.code === 'P2002') {
        throw new BadRequestException('This account is already registered as a rider.');
      }
      throw e;
    }

    const ownerIds = await this.access.merchantUserIds(merchant.id);
    await Promise.all(
      ownerIds.map((uid) =>
        this.notifications.notify({
          userId: uid,
          title: 'New rider request',
          body: `${dto.fullName} wants to deliver for ${merchant.shopName}.`,
          type: NotificationType.SYSTEM,
        }),
      ),
    );

    const tokens = await this.auth.issueTokens(userId, UserRole.RIDER);
    return { rider, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

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
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) {
      throw new BadRequestException('Choose a valid location');
    }
    const rider = await this.access.riderByUser(userId);
    if (!rider.isActive || rider.approvalStatus !== 'APPROVED') throw new ForbiddenException('Rider is not active');
    const orderId = input.orderId ?? rider.currentOrderId;
    if (!orderId) throw new BadRequestException('An active assigned delivery is required');
    await serializable(this.prisma, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, riderId: rider.id }, select: { status: true } });
      if (!order || ![OrderStatus.RIDER_ASSIGNED, OrderStatus.RIDER_ARRIVED_AT_SHOP, OrderStatus.ON_THE_WAY, OrderStatus.RIDER_ARRIVED_AT_CUSTOMER].includes(order.status as any)) {
        throw new ForbiddenException('Location is allowed only for your active assigned delivery');
      }
      await tx.rider.update({ where: { id: rider.id }, data: { latitude: input.latitude, longitude: input.longitude } });
      await tx.riderLocationUpdate.create({ data: { riderId: rider.id, orderId, latitude: input.latitude, longitude: input.longitude, speed: input.speed ?? null, heading: input.heading ?? null } });
    });
    {
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
    const changed = await serializable(this.prisma, async (tx) => {
      const claim = await tx.rider.updateMany({ where: { id: rider.id, currentOrderId: order.id }, data: { currentStatus: RiderStatus.PICKING_UP } });
      if (claim.count !== 1) throw new ConflictException('Delivery assignment changed');
      return this.statusService.applyInTransaction(tx, order.id, OrderStatus.RIDER_ARRIVED_AT_SHOP, {
        userId, role: 'RIDER', latitude: location?.latitude, longitude: location?.longitude,
      }, {}, [OrderStatus.RIDER_ASSIGNED]);
    });
    this.statusService.broadcastStatus(changed);
    return { ok: true, status: OrderStatus.RIDER_ARRIVED_AT_SHOP };
  }

  async pickedUp(userId: string, orderId: string, location?: { latitude?: number; longitude?: number }) {
    const { rider, order } = await this.ownedActiveOrder(userId, orderId, [
      OrderStatus.RIDER_ASSIGNED,
      OrderStatus.RIDER_ARRIVED_AT_SHOP,
    ]);
    const changed = await serializable(this.prisma, async (tx) => {
      const claim = await tx.rider.updateMany({ where: { id: rider.id, currentOrderId: order.id }, data: { currentStatus: RiderStatus.DELIVERING } });
      if (claim.count !== 1) throw new ConflictException('Delivery assignment changed');
      await this.statusService.appendTimeline(order.id, OrderStatus.PICKED_UP, {
        userId, role: 'RIDER', latitude: location?.latitude, longitude: location?.longitude,
      }, tx);
      return this.statusService.applyInTransaction(tx, order.id, OrderStatus.ON_THE_WAY, {
        userId, role: 'RIDER',
      }, { pickedUpAt: new Date() }, [OrderStatus.RIDER_ASSIGNED, OrderStatus.RIDER_ARRIVED_AT_SHOP]);
    });
    this.statusService.broadcastStatus(changed);

    await this.afterCommit(() => this.notifications.notify({
      userId: order.customer.userId,
      title: 'Order picked up',
      body: `Your order ${order.orderNumber} is on the way. Share the delivery code with the rider on arrival.`,
      type: NotificationType.ORDER_PICKED_UP,
      referenceId: order.id,
    }));
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
    await this.afterCommit(() => this.notifications.notify({
      userId: order.customer.userId,
      title: 'Rider has arrived',
      body: `Your rider is at your door with order ${order.orderNumber}.`,
      type: NotificationType.RIDER_NEARBY,
      referenceId: order.id,
    }));
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

    const masterOk = process.env.NODE_ENV !== 'production' && (process.env.OTP_PROVIDER || 'mock') === 'mock' && input.otp === '123456';
    if (!masterOk && input.otp !== order.deliveryOtp) {
      throw new BadRequestException('Incorrect delivery code — ask the customer for the code in their app');
    }

    const changed = await serializable(this.prisma, async (tx) => {
      const claimedRider = await tx.rider.updateMany({
        where: { id: rider.id, currentOrderId: order.id },
        data: { currentStatus: RiderStatus.IDLE, currentOrderId: null },
      });
      if (claimedRider.count !== 1) throw new ConflictException('Delivery assignment changed');
      const result = await this.statusService.applyInTransaction(tx, order.id, OrderStatus.DELIVERED, {
        userId,
        role: 'RIDER',
        notes: input.note ?? (input.photoUrl ? `Photo: ${input.photoUrl}` : undefined),
      }, { deliveredAt: new Date() }, [OrderStatus.ON_THE_WAY, OrderStatus.RIDER_ARRIVED_AT_CUSTOMER]);
      // COD collection and delivery must never be visible independently.
      if (order.paymentMethod === 'COD') {
        await tx.order.updateMany({
          where: { id: order.id, paymentStatus: PaymentStatus.CASH_PENDING },
          data: { paymentStatus: PaymentStatus.CASH_COLLECTED },
        });
        if (!order.parentOrderId) {
          const currentOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { totalAmountPaisa: true } });
          const collected = await tx.payment.updateMany({
            where: { orderId: order.id, status: PaymentStatus.CASH_PENDING },
            data: { status: PaymentStatus.CASH_COLLECTED, amountPaisa: currentOrder.totalAmountPaisa },
          });
          if (collected.count !== 1) throw new ConflictException('COD collection record changed');
        }
      }
      return result;
    });
    this.statusService.broadcastStatus(changed);

    await this.afterCommit(async () => {
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
