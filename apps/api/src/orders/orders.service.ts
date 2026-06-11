import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { RefundsService } from '../refunds/refunds.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AccessService } from '../common/access.service';
import { PricingService } from '../common/pricing.service';
import { OrderStatusService } from './order-status.service';
import {
  MerchantApprovalStatus,
  NotificationType,
  ONLINE_PAYMENT_METHODS,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../common/constants';
import { haversineKm, estimateDeliveryMinutes } from '../common/utils/geo';
import { generateNumericCode, generateOrderNumber } from '../common/utils/ids';

export interface PlaceOrderInput {
  deliveryAddressId: string;
  paymentMethod: string;
  customerNote?: string;
  couponCode?: string;
}

const CUSTOMER_CANCELLABLE: string[] = [
  OrderStatus.CREATED,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAYMENT_CONFIRMED,
  OrderStatus.SENT_TO_MERCHANT,
];

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Orders');
  private timeoutTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly coupons: CouponsService,
    private readonly refunds: RefundsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly access: AccessService,
    private readonly pricing: PricingService,
    private readonly statusService: OrderStatusService,
  ) {}

  // ── Order placement ────────────────────────────────────────────────────────

  async placeOrder(customerUserId: string, input: PlaceOrderInput) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerUserId },
      include: { user: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const cart = await this.prisma.cart.findFirst({
      where: { customerId: customer.id, status: 'ACTIVE' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Your cart is empty');

    const address = await this.prisma.customerAddress.findFirst({
      where: { id: input.deliveryAddressId, customerId: customer.id },
    });
    if (!address) throw new BadRequestException('Delivery address not found');

    const allMethods = [PaymentMethod.COD, ...ONLINE_PAYMENT_METHODS] as string[];
    if (!allMethods.includes(input.paymentMethod)) {
      throw new BadRequestException('Unsupported payment method');
    }

    // Load and validate every line item against live merchant/product state.
    const merchantProducts = await this.prisma.merchantProduct.findMany({
      where: { id: { in: cart.items.map((i) => i.merchantProductId) } },
      include: { product: true, merchant: true },
    });
    const mpById = new Map(merchantProducts.map((mp) => [mp.id, mp]));

    interface Line {
      cartItem: (typeof cart.items)[number];
      mp: (typeof merchantProducts)[number];
      unitPricePaisa: number;
    }
    const groups = new Map<string, Line[]>();
    for (const item of cart.items) {
      const mp = mpById.get(item.merchantProductId);
      if (!mp) throw new BadRequestException('A cart item is no longer sold by this shop');
      const m = mp.merchant;
      if (m.approvalStatus !== MerchantApprovalStatus.APPROVED || !m.isOpen || !m.isOnline) {
        throw new BadRequestException(`${m.shopName} is not accepting orders right now`);
      }
      if (!mp.isAvailable || mp.stockQuantity < item.quantity) {
        throw new BadRequestException(`${mp.product.name} has insufficient stock at ${m.shopName}`);
      }
      if (address.latitude != null && address.longitude != null) {
        const distance = haversineKm(address.latitude, address.longitude, m.latitude, m.longitude);
        if (distance > m.serviceRadiusKm) {
          throw new BadRequestException(`${m.shopName} does not deliver to this address`);
        }
      }
      const line: Line = {
        cartItem: item,
        mp,
        unitPricePaisa: mp.discountPricePaisa ?? mp.pricePaisa,
      };
      const list = groups.get(mp.merchantId) ?? [];
      list.push(line);
      groups.set(mp.merchantId, list);
    }

    // Per-merchant subtotals + minimum order checks.
    const perMerchant = [...groups.entries()].map(([merchantId, lines]) => {
      const merchant = lines[0].mp.merchant;
      const subtotalPaisa = lines.reduce((s, l) => s + l.unitPricePaisa * l.cartItem.quantity, 0);
      if (subtotalPaisa < merchant.minimumOrderValuePaisa) {
        throw new BadRequestException(
          `${merchant.shopName} requires a minimum order of Rs ${(merchant.minimumOrderValuePaisa / 100).toFixed(0)}`,
        );
      }
      let distanceKm: number | null = null;
      if (address.latitude != null && address.longitude != null) {
        distanceKm = haversineKm(address.latitude, address.longitude, merchant.latitude, merchant.longitude);
      }
      return {
        merchantId,
        merchant,
        lines,
        subtotalPaisa,
        distanceKm,
        deliveryFeePaisa: this.pricing.deliveryFeePaisa(distanceKm),
        commissionPaisa: this.pricing.commissionPaisa(merchant, subtotalPaisa),
        etaMinutes: estimateDeliveryMinutes(distanceKm ?? 3, merchant.averagePreparationMinutes),
      };
    });

    const totalSubtotal = perMerchant.reduce((s, g) => s + g.subtotalPaisa, 0);
    const serviceFeePaisa = this.pricing.serviceFeePaisa();
    const smallOrderFeePaisa = this.pricing.smallOrderFeePaisa(totalSubtotal);

    // Coupon (cart-level or passed at checkout).
    const couponCode = input.couponCode ?? cart.couponCode ?? undefined;
    let discountPaisa = 0;
    let couponId: string | undefined;
    let freeDelivery = false;
    if (couponCode) {
      const quote = await this.coupons.validate({
        code: couponCode,
        customerId: customer.id,
        subtotalPaisa: totalSubtotal,
        merchantIds: perMerchant.map((g) => g.merchantId),
        city: address.city,
        paymentMethod: input.paymentMethod,
      });
      discountPaisa = quote.discountPaisa;
      couponId = quote.couponId;
      freeDelivery = quote.freeDelivery;
    }
    if (freeDelivery) perMerchant.forEach((g) => (g.deliveryFeePaisa = 0));

    const totalDeliveryFee = perMerchant.reduce((s, g) => s + g.deliveryFeePaisa, 0);
    const grandTotalPaisa = Math.max(
      0,
      totalSubtotal + totalDeliveryFee + serviceFeePaisa + smallOrderFeePaisa - discountPaisa,
    );

    const isOnlinePayment = (ONLINE_PAYMENT_METHODS as string[]).includes(input.paymentMethod);
    const initialStatus = isOnlinePayment ? OrderStatus.PAYMENT_PENDING : OrderStatus.SENT_TO_MERCHANT;
    const initialPaymentStatus = isOnlinePayment ? PaymentStatus.PENDING : PaymentStatus.CASH_PENDING;
    const isMulti = perMerchant.length > 1;

    const result = await this.prisma.$transaction(async (tx) => {
      // Atomic stock decrement; fails the whole checkout on a race.
      for (const g of perMerchant) {
        for (const line of g.lines) {
          const updated = await tx.merchantProduct.updateMany({
            where: { id: line.mp.id, stockQuantity: { gte: line.cartItem.quantity } },
            data: { stockQuantity: { decrement: line.cartItem.quantity } },
          });
          if (updated.count !== 1) {
            throw new BadRequestException(`${line.mp.product.name} just went out of stock`);
          }
        }
      }

      let parentId: string | null = null;
      if (isMulti) {
        const parent = await tx.order.create({
          data: {
            isParent: true,
            orderNumber: generateOrderNumber(),
            customerId: customer.id,
            deliveryAddressId: address.id,
            status: initialStatus,
            paymentStatus: initialPaymentStatus,
            paymentMethod: input.paymentMethod,
            subtotalPaisa: totalSubtotal,
            deliveryFeePaisa: totalDeliveryFee,
            serviceFeePaisa,
            smallOrderFeePaisa,
            discountAmountPaisa: discountPaisa,
            totalAmountPaisa: grandTotalPaisa,
            couponCode: couponCode ?? null,
            customerNote: input.customerNote ?? null,
          },
        });
        parentId = parent.id;
      }

      const childOrders: any[] = [];
      for (const g of perMerchant) {
        const childTotal = isMulti
          ? g.subtotalPaisa + g.deliveryFeePaisa
          : grandTotalPaisa;
        const order = await tx.order.create({
          data: {
            parentOrderId: parentId,
            orderNumber: generateOrderNumber(),
            customerId: customer.id,
            merchantId: g.merchantId,
            deliveryAddressId: address.id,
            status: initialStatus,
            paymentStatus: initialPaymentStatus,
            paymentMethod: input.paymentMethod,
            subtotalPaisa: g.subtotalPaisa,
            deliveryFeePaisa: g.deliveryFeePaisa,
            serviceFeePaisa: isMulti ? 0 : serviceFeePaisa,
            smallOrderFeePaisa: isMulti ? 0 : smallOrderFeePaisa,
            discountAmountPaisa: isMulti ? 0 : discountPaisa,
            commissionAmountPaisa: g.commissionPaisa,
            totalAmountPaisa: childTotal,
            merchantEarningPaisa: g.subtotalPaisa - g.commissionPaisa,
            couponCode: isMulti ? null : (couponCode ?? null),
            customerNote: input.customerNote ?? null,
            deliveryOtp: generateNumericCode(4),
            estimatedDeliveryMinutes: g.etaMinutes,
          },
        });
        await tx.orderItem.createMany({
          data: g.lines.map((line) => ({
            orderId: order.id,
            productId: line.mp.productId,
            merchantProductId: line.mp.id,
            productNameSnapshot: line.mp.product.name,
            productImageSnapshot: line.mp.product.imageUrl,
            unitSnapshot: line.mp.product.unit,
            quantity: line.cartItem.quantity,
            unitPricePaisa: line.unitPricePaisa,
            totalPricePaisa: line.unitPricePaisa * line.cartItem.quantity,
          })),
        });
        await tx.orderTimelineEntry.createMany({
          data: [
            { orderId: order.id, status: OrderStatus.CREATED, changedByUserId: customerUserId, changedByRole: 'CUSTOMER' },
            { orderId: order.id, status: initialStatus, changedByRole: 'SYSTEM' },
          ],
        });
        childOrders.push(order);
      }

      const paymentAnchorId = parentId ?? childOrders[0].id;
      await tx.payment.create({
        data: {
          orderId: paymentAnchorId,
          customerId: customer.id,
          amountPaisa: grandTotalPaisa,
          paymentMethod: input.paymentMethod,
          paymentProvider: isOnlinePayment ? input.paymentMethod.toLowerCase() : 'cod',
          status: initialPaymentStatus,
        },
      });

      if (couponId) {
        await tx.couponUsage.create({
          data: {
            couponId,
            customerId: customer.id,
            orderId: paymentAnchorId,
            discountAmountPaisa: discountPaisa,
          },
        });
      }

      await tx.cart.update({ where: { id: cart.id }, data: { status: 'CHECKED_OUT' } });
      return { parentId, childOrders };
    });

    // Post-commit notifications + realtime (only when already sent to merchants).
    if (!isOnlinePayment) {
      await this.announceToMerchants(result.childOrders, customer.user.fullName ?? 'A customer');
    }
    await this.notifications.notify({
      userId: customerUserId,
      title: 'Order placed',
      body: isOnlinePayment
        ? 'Complete the payment to send your order to the shop.'
        : 'Your order was sent to the shop. We will notify you when it is accepted.',
      type: NotificationType.ORDER_PLACED,
      referenceId: result.parentId ?? result.childOrders[0].id,
    });

    return this.detailForCustomer(customerUserId, result.parentId ?? result.childOrders[0].id);
  }

  /** Called by PaymentsService after a successful online payment. */
  async onPaymentConfirmed(anchorOrderId: string) {
    const anchor = await this.prisma.order.findUnique({
      where: { id: anchorOrderId },
      include: { children: true, customer: { include: { user: true } } },
    });
    if (!anchor) return;
    const orders = anchor.isParent ? anchor.children : [anchor];

    await this.prisma.order.updateMany({
      where: { id: { in: [anchor.id, ...orders.map((o) => o.id)] } },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    for (const order of orders) {
      await this.statusService.apply(order.id, OrderStatus.SENT_TO_MERCHANT, {
        role: 'SYSTEM',
        notes: 'Payment confirmed',
      });
    }
    if (anchor.isParent) {
      await this.statusService.apply(anchor.id, OrderStatus.SENT_TO_MERCHANT, {
        role: 'SYSTEM',
        notes: 'Payment confirmed',
      });
    }
    await this.announceToMerchants(orders, anchor.customer.user.fullName ?? 'A customer');
  }

  private async announceToMerchants(orders: { id: string; merchantId: string | null; orderNumber: string; totalAmountPaisa: number }[], customerName: string) {
    for (const order of orders) {
      if (!order.merchantId) continue;
      const userIds = await this.access.merchantUserIds(order.merchantId);
      await this.notifications.notifyMany(userIds, {
        title: 'New order received',
        body: `${customerName} placed order ${order.orderNumber} (Rs ${(order.totalAmountPaisa / 100).toFixed(0)}).`,
        type: NotificationType.NEW_ORDER,
        referenceId: order.id,
      });
      this.realtime.emitToMerchant(order.merchantId, 'order:new', {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  }

  // ── Customer queries ───────────────────────────────────────────────────────

  async listForCustomer(customerUserId: string, status?: string) {
    const customerId = await this.access.customerId(customerUserId);
    return this.prisma.order.findMany({
      where: {
        customerId,
        parentOrderId: null, // parents and standalone orders only
        ...(status ? { status } : {}),
      },
      include: {
        items: true,
        merchant: { select: { id: true, shopName: true, logoUrl: true } },
        children: {
          include: {
            items: true,
            merchant: { select: { id: true, shopName: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async detailForCustomer(customerUserId: string, orderId: string) {
    const customerId = await this.access.customerId(customerUserId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        deliveryAddress: true,
        merchant: { select: { id: true, shopName: true, logoUrl: true, phoneNumber: true } },
        rider: { select: { id: true, fullName: true, phoneNumber: true, vehicleType: true, vehicleNumber: true, profileImageUrl: true } },
        payments: true,
        refunds: true,
        children: {
          include: {
            items: true,
            timeline: { orderBy: { createdAt: 'asc' } },
            merchant: { select: { id: true, shopName: true, logoUrl: true, phoneNumber: true } },
            rider: { select: { id: true, fullName: true, phoneNumber: true, vehicleType: true, vehicleNumber: true, profileImageUrl: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.redactOtp(order);
  }

  /** Live tracking payload: status + rider + last known location + OTP when due. */
  async track(customerUserId: string, orderId: string) {
    const order = await this.detailForCustomer(customerUserId, orderId);
    const targets = order.isParent ? order.children : [order];

    const tracking = await Promise.all(
      targets.map(async (o: any) => {
        let riderLocation: any = null;
        if (o.riderId) {
          riderLocation = await this.prisma.riderLocationUpdate.findFirst({
            where: { orderId: o.id },
            orderBy: { createdAt: 'desc' },
            select: { latitude: true, longitude: true, heading: true, createdAt: true },
          });
        }
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          merchant: o.merchant,
          rider: o.rider,
          riderLocation,
          estimatedDeliveryMinutes: o.estimatedDeliveryMinutes,
          deliveryOtp: o.deliveryOtp,
          timeline: o.timeline,
        };
      }),
    );
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      isParent: order.isParent,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmountPaisa: order.totalAmountPaisa,
      deliveries: tracking,
    };
  }

  // ── Cancellation ───────────────────────────────────────────────────────────

  async cancelByCustomer(customerUserId: string, orderId: string, reason?: string) {
    const customerId = await this.access.customerId(customerUserId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { children: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const targets = order.isParent ? order.children : [order];
    const blocked = targets.filter((o) => !CUSTOMER_CANCELLABLE.includes(o.status));
    if (blocked.length > 0) {
      throw new BadRequestException(
        'Order can no longer be cancelled — the shop has already accepted it. Contact support.',
      );
    }

    for (const child of targets) {
      await this.restoreStock(child.id);
      await this.statusService.apply(child.id, OrderStatus.CANCELLED_BY_CUSTOMER, {
        userId: customerUserId,
        role: 'CUSTOMER',
        notes: reason,
      }, { cancellationReason: reason ?? 'Cancelled by customer', cancelledAt: new Date() });
      if (child.merchantId) {
        const userIds = await this.access.merchantUserIds(child.merchantId);
        await this.notifications.notifyMany(userIds, {
          title: 'Order cancelled',
          body: `Order ${child.orderNumber} was cancelled by the customer.`,
          type: NotificationType.ORDER_CANCELLED,
          referenceId: child.id,
        });
      }
    }
    if (order.isParent) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED_BY_CUSTOMER,
          cancellationReason: reason ?? 'Cancelled by customer',
          cancelledAt: new Date(),
        },
      });
    }
    await this.refundIfPaid(order.isParent ? order.id : targets[0].id, customerId, 'Order cancelled by customer');
    return this.detailForCustomer(customerUserId, orderId);
  }

  /** Restores stock for all confirmed items of an order (spec 12.8). */
  async restoreStock(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, itemStatus: { in: ['CONFIRMED', 'REPLACEMENT_SUGGESTED'] } },
    });
    for (const item of items) {
      await this.prisma.merchantProduct.update({
        where: { id: item.merchantProductId },
        data: { stockQuantity: { increment: item.quantity } },
      }).catch(() => undefined);
    }
  }

  /** Auto-refund of online payments when an order dies before fulfilment. */
  async refundIfPaid(anchorOrderId: string, customerId: string, reason: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: anchorOrderId, status: PaymentStatus.PAID },
    });
    if (!payment) return;
    await this.refunds.create({
      orderId: anchorOrderId,
      customerId,
      amountPaisa: payment.amountPaisa,
      reason,
      autoApprove: true,
    });
  }

  // ── Ratings ────────────────────────────────────────────────────────────────

  async rate(
    customerUserId: string,
    orderId: string,
    input: { merchantRating?: number; riderRating?: number; reviewText?: string },
  ) {
    const customerId = await this.access.customerId(customerUserId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { children: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const targets = order.isParent ? order.children : [order];
    if (!targets.every((o) => o.status === OrderStatus.DELIVERED)) {
      throw new BadRequestException('You can rate an order after it is delivered');
    }

    const reviews: any[] = [];
    for (const child of targets) {
      if (input.merchantRating && child.merchantId) {
        reviews.push(
          await this.upsertReview({
            orderId: child.id,
            customerId,
            merchantId: child.merchantId,
            rating: input.merchantRating,
            reviewText: input.reviewText,
            reviewType: 'MERCHANT',
          }),
        );
        await this.recomputeMerchantRating(child.merchantId);
      }
      if (input.riderRating && child.riderId) {
        reviews.push(
          await this.upsertReview({
            orderId: child.id,
            customerId,
            riderId: child.riderId,
            rating: input.riderRating,
            reviewText: input.reviewText,
            reviewType: 'RIDER',
          }),
        );
      }
    }
    return { reviews };
  }

  private async upsertReview(data: {
    orderId: string;
    customerId: string;
    merchantId?: string;
    riderId?: string;
    rating: number;
    reviewText?: string;
    reviewType: string;
  }) {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    const existing = await this.prisma.review.findFirst({
      where: { orderId: data.orderId, reviewType: data.reviewType },
    });
    if (existing) {
      return this.prisma.review.update({
        where: { id: existing.id },
        data: { rating: data.rating, reviewText: data.reviewText ?? existing.reviewText },
      });
    }
    return this.prisma.review.create({
      data: {
        orderId: data.orderId,
        customerId: data.customerId,
        merchantId: data.merchantId ?? null,
        riderId: data.riderId ?? null,
        rating: data.rating,
        reviewText: data.reviewText ?? null,
        reviewType: data.reviewType,
      },
    });
  }

  private async recomputeMerchantRating(merchantId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { merchantId, reviewType: 'MERCHANT' },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        ratingAverage: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        ratingCount: agg._count.rating,
      },
    });
  }

  // ── Support ticket from an order ───────────────────────────────────────────

  async createSupportTicket(
    customerUserId: string,
    orderId: string,
    input: { issueCategory: string; title: string; description: string },
  ) {
    const customerId = await this.access.customerId(customerUserId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.supportTicket.create({
      data: {
        orderId: order.id,
        customerId,
        merchantId: order.merchantId,
        riderId: order.riderId,
        createdByUserId: customerUserId,
        issueCategory: input.issueCategory,
        title: input.title,
        description: input.description,
      },
    });
  }

  // ── Replacement response (spec 20.6) ───────────────────────────────────────

  async respondToReplacement(
    customerUserId: string,
    orderId: string,
    itemId: string,
    accept: boolean,
  ) {
    const customerId = await this.access.customerId(customerUserId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const suggestion = order.items.find(
      (i) => i.replacementForItemId === itemId && i.itemStatus === 'REPLACEMENT_SUGGESTED',
    );
    const original = order.items.find((i) => i.id === itemId);
    if (!suggestion || !original) throw new NotFoundException('No pending replacement for this item');

    if (accept) {
      await this.prisma.orderItem.update({ where: { id: original.id }, data: { itemStatus: 'REPLACED' } });
      await this.prisma.orderItem.update({ where: { id: suggestion.id }, data: { itemStatus: 'CONFIRMED' } });
    } else {
      await this.prisma.orderItem.update({ where: { id: original.id }, data: { itemStatus: 'UNAVAILABLE' } });
      await this.prisma.orderItem.update({ where: { id: suggestion.id }, data: { itemStatus: 'REMOVED' } });
      // Return the suggested item's reserved stock.
      await this.prisma.merchantProduct.update({
        where: { id: suggestion.merchantProductId },
        data: { stockQuantity: { increment: suggestion.quantity } },
      }).catch(() => undefined);
    }
    await this.recomputeOrderTotals(order.id);
    await this.statusService.appendTimeline(order.id, 'REPLACEMENT_' + (accept ? 'ACCEPTED' : 'REJECTED'), {
      userId: customerUserId,
      role: 'CUSTOMER',
      notes: `Item ${original.productNameSnapshot}`,
    });
    if (order.merchantId) {
      const userIds = await this.access.merchantUserIds(order.merchantId);
      await this.notifications.notifyMany(userIds, {
        title: accept ? 'Replacement accepted' : 'Replacement rejected',
        body: `Customer ${accept ? 'accepted' : 'rejected'} the replacement for ${original.productNameSnapshot} on order ${order.orderNumber}.`,
        type: NotificationType.REPLACEMENT_REQUESTED,
        referenceId: order.id,
      });
    }
    return this.detailForCustomer(customerUserId, orderId);
  }

  /** Re-derives money fields after item-level changes. */
  async recomputeOrderTotals(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, merchant: true },
    });
    if (!order || !order.merchant) return;
    const subtotal = order.items
      .filter((i) => i.itemStatus === 'CONFIRMED')
      .reduce((s, i) => s + i.totalPricePaisa, 0);
    const commission = this.pricing.commissionPaisa(order.merchant, subtotal);
    const total = Math.max(
      0,
      subtotal + order.deliveryFeePaisa + order.serviceFeePaisa + order.smallOrderFeePaisa - order.discountAmountPaisa,
    );
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotalPaisa: subtotal,
        commissionAmountPaisa: commission,
        merchantEarningPaisa: subtotal - commission,
        totalAmountPaisa: total,
      },
    });
    if (order.parentOrderId) {
      const siblings = await this.prisma.order.findMany({ where: { parentOrderId: order.parentOrderId } });
      const parent = await this.prisma.order.findUnique({ where: { id: order.parentOrderId } });
      if (parent) {
        const subtotalSum = siblings.reduce((s, o) => s + o.subtotalPaisa, 0);
        const deliverySum = siblings.reduce((s, o) => s + o.deliveryFeePaisa, 0);
        await this.prisma.order.update({
          where: { id: parent.id },
          data: {
            subtotalPaisa: subtotalSum,
            deliveryFeePaisa: deliverySum,
            totalAmountPaisa: Math.max(
              0,
              subtotalSum + deliverySum + parent.serviceFeePaisa + parent.smallOrderFeePaisa - parent.discountAmountPaisa,
            ),
          },
        });
      }
    }
  }

  // ── Merchant acceptance timeout (spec 20.5) ────────────────────────────────

  onModuleInit() {
    const minutes = Number(process.env.MERCHANT_ACCEPT_TIMEOUT_MINUTES || 10);
    if (minutes <= 0) return;
    this.timeoutTimer = setInterval(() => {
      this.expireUnacceptedOrders(minutes).catch((err) =>
        this.logger.warn(`Timeout sweep failed: ${err}`),
      );
    }, 60_000);
    this.timeoutTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.timeoutTimer) clearInterval(this.timeoutTimer);
  }

  async expireUnacceptedOrders(timeoutMinutes: number) {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.SENT_TO_MERCHANT,
        isParent: false,
        createdAt: { lt: cutoff },
      },
      include: { customer: true },
      take: 50,
    });
    for (const order of stale) {
      this.logger.log(`Auto-rejecting unaccepted order ${order.orderNumber}`);
      await this.restoreStock(order.id);
      await this.statusService.apply(order.id, OrderStatus.MERCHANT_REJECTED, {
        role: 'SYSTEM',
        notes: `Shop did not respond within ${timeoutMinutes} minutes`,
      }, { cancellationReason: 'Merchant did not respond in time', cancelledAt: new Date() });
      await this.notifications.notify({
        userId: order.customer.userId,
        title: 'Order not accepted',
        body: `The shop did not respond to order ${order.orderNumber} in time. Any payment will be refunded.`,
        type: NotificationType.ORDER_TIMEOUT,
        referenceId: order.id,
      });
      const anchorId = order.parentOrderId ?? order.id;
      await this.refundIfPaid(anchorId, order.customerId, 'Merchant did not respond in time');
    }
  }

  /** Customers never see the delivery OTP until the rider has picked up. */
  private redactOtp(order: any) {
    const reveal = [
      OrderStatus.PICKED_UP,
      OrderStatus.ON_THE_WAY,
      OrderStatus.RIDER_ARRIVED_AT_CUSTOMER,
    ] as string[];
    const strip = (o: any) => {
      if (o && !reveal.includes(o.status)) o.deliveryOtp = null;
      return o;
    };
    strip(order);
    order.children?.forEach(strip);
    return order;
  }
}
