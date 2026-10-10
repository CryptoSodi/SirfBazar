import {
  BadRequestException,
  ConflictException,
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
  CANCELLED_ORDER_STATUSES,
  NotificationType,
  ONLINE_PAYMENT_METHODS,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RiderStatus,
} from '../common/constants';
import { haversineKm, estimateDeliveryMinutes } from '../common/utils/geo';
import { generateNumericCode, generateOrderNumber } from '../common/utils/ids';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { serializable } from '../common/transaction';
import { lockOwners } from '../common/owner-lock';
import { isMerchantOpenAt } from '../common/merchant-hours';

export interface PlaceOrderInput {
  requestId: string;
  cartId: string;
  approvedQuote?: string;
  deliveryAddressId: string;
  paymentMethod: string;
  customerNote?: string;
  couponCode?: string;
}

type QuoteInput = Pick<PlaceOrderInput, 'cartId' | 'deliveryAddressId' | 'paymentMethod' | 'couponCode'>;
const MAX_PAISA = 2_147_483_647;
const safePaisa = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_PAISA) {
    throw new BadRequestException('Order amount is outside the supported range');
  }
  return amount;
};

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
  private revisionTimer?: NodeJS.Timeout;

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

  private quoteKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required for approved checkout');
    return createHmac('sha256', secret || 'dev-secret-do-not-use-in-production')
      .update('sirfbazar-approved-checkout-v1')
      .digest();
  }

  private digest(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private signQuote(customerId: string, quote: unknown) {
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const payload = Buffer.from(JSON.stringify({ version: 1, customerId, digest: this.digest(quote), expiresAt: expiresAt.toISOString() })).toString('base64url');
    const signature = createHmac('sha256', this.quoteKey()).update(payload).digest('base64url');
    return { version: 1, approvedQuote: `${payload}.${signature}`, expiresAt: expiresAt.toISOString(), quote };
  }

  private parseQuote(token: string, customerId: string) {
    try {
      const [payload, signature, extra] = token.split('.');
      if (!payload || !signature || extra) throw new Error('format');
      const expected = createHmac('sha256', this.quoteKey()).update(payload).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('signature');
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (parsed.version !== 1 || parsed.customerId !== customerId || typeof parsed.digest !== 'string') throw new Error('owner');
      return parsed as { digest: string; expiresAt: string };
    } catch {
      throw new ConflictException({ code: 'QUOTE_CHANGED', message: 'Review the current order total before placing your order.' });
    }
  }

  private async buildQuote(db: PrismaService | Prisma.TransactionClient, customerId: string, input: QuoteInput) {
    if (input.paymentMethod !== PaymentMethod.COD) throw new BadRequestException('Only cash on delivery is available');
    const cart = await db.cart.findFirst({ where: { id: input.cartId, customerId, status: 'ACTIVE' }, include: { items: true } });
    if (!cart || cart.items.length === 0) throw new ConflictException('This checkout basket is no longer active. Check your orders before retrying.');
    const address = await db.customerAddress.findFirst({ where: { id: input.deliveryAddressId, customerId } });
    if (!address) throw new BadRequestException('Delivery address not found');
    if (address.latitude == null || address.longitude == null || !Number.isFinite(address.latitude) || !Number.isFinite(address.longitude) || Math.abs(address.latitude) > 90 || Math.abs(address.longitude) > 180) {
      throw new BadRequestException('Choose a valid delivery location before checkout');
    }
    const listings = await db.merchantProduct.findMany({
      where: { id: { in: cart.items.map((item) => item.merchantProductId) } },
      include: { product: { include: { category: true } }, merchant: { include: { operatingHours: true } } },
    });
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const groups = new Map<string, { merchant: (typeof listings)[number]['merchant']; items: Array<{ merchantProductId: string; productId: string; merchantId: string; name: string; quantity: number; unitPricePaisa: number }> }>();
    for (const item of cart.items) {
      const listing = byId.get(item.merchantProductId);
      if (!listing || listing.product.approvalStatus !== 'APPROVED' || listing.product.isRestricted || listing.product.requiresPrescription || listing.product.category.isRestricted || !listing.product.category.isActive) {
        throw new BadRequestException('A product in your basket is unavailable for checkout');
      }
      const merchant = listing.merchant;
      if (merchant.approvalStatus !== MerchantApprovalStatus.APPROVED || !merchant.isOpen || !merchant.isOnline) throw new BadRequestException(`${merchant.shopName} is not accepting orders right now`);
      if (!isMerchantOpenAt(merchant.operatingHours, merchant.openingTime, merchant.closingTime)) throw new BadRequestException(`${merchant.shopName} is outside its posted delivery hours`);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || !listing.isAvailable || listing.stockQuantity < item.quantity) throw new BadRequestException(`${listing.product.name} has insufficient stock`);
      if (!Number.isFinite(merchant.latitude) || !Number.isFinite(merchant.longitude) || !Number.isFinite(merchant.serviceRadiusKm) || merchant.serviceRadiusKm <= 0 || haversineKm(address.latitude, address.longitude, merchant.latitude, merchant.longitude) > merchant.serviceRadiusKm) {
        throw new BadRequestException(`${merchant.shopName} does not deliver to this address`);
      }
      const unitPricePaisa = safePaisa(listing.discountPricePaisa ?? listing.pricePaisa);
      if (unitPricePaisa < 1) throw new BadRequestException('A product has an invalid price');
      safePaisa(unitPricePaisa * item.quantity);
      const group = groups.get(merchant.id) ?? { merchant, items: [] };
      group.items.push({ merchantProductId: listing.id, productId: listing.productId, merchantId: merchant.id, name: listing.product.name, quantity: item.quantity, unitPricePaisa });
      groups.set(merchant.id, group);
    }
    const merchants = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([merchantId, group]) => {
      const subtotalPaisa = safePaisa(group.items.reduce((sum, item) => safePaisa(sum + item.unitPricePaisa * item.quantity), 0));
      if (subtotalPaisa < group.merchant.minimumOrderValuePaisa) throw new BadRequestException(`${group.merchant.shopName} requires a larger order`);
      const distanceKm = haversineKm(address.latitude!, address.longitude!, group.merchant.latitude, group.merchant.longitude);
      return { merchantId, shopName: group.merchant.shopName, subtotalPaisa, deliveryFeePaisa: safePaisa(this.pricing.deliveryFeePaisa(distanceKm)) };
    });
    const subtotalPaisa = safePaisa(merchants.reduce((sum, merchant) => safePaisa(sum + merchant.subtotalPaisa), 0));
    const couponCode = input.couponCode ?? cart.couponCode ?? null;
    const coupon = couponCode ? await this.coupons.validate({ code: couponCode, customerId, subtotalPaisa, merchantIds: merchants.map((m) => m.merchantId), categoryIds: listings.map((l) => l.product.categoryId), city: address.city, paymentMethod: input.paymentMethod }, db) : null;
    if (coupon?.freeDelivery) merchants.forEach((merchant) => { merchant.deliveryFeePaisa = 0; });
    const deliveryFeePaisa = safePaisa(merchants.reduce((sum, merchant) => safePaisa(sum + merchant.deliveryFeePaisa), 0));
    const serviceFeePaisa = safePaisa(this.pricing.serviceFeePaisa());
    const smallOrderFeePaisa = safePaisa(this.pricing.smallOrderFeePaisa(subtotalPaisa));
    const discountPaisa = safePaisa(coupon?.discountPaisa ?? 0);
    const totalAmountPaisa = safePaisa(Math.max(0, subtotalPaisa + deliveryFeePaisa + serviceFeePaisa + smallOrderFeePaisa - discountPaisa));
    return { cartId: cart.id, paymentMethod: input.paymentMethod, deliveryAddress: { id: address.id, fullAddress: address.fullAddress, city: address.city, latitude: address.latitude, longitude: address.longitude }, items: [...groups.values()].flatMap((group) => group.items).sort((a, b) => a.merchantProductId.localeCompare(b.merchantProductId)), merchants, subtotalPaisa, deliveryFeePaisa, serviceFeePaisa, smallOrderFeePaisa, discountPaisa, couponCode, totalAmountPaisa };
  }

  async quoteOrder(customerUserId: string, input: QuoteInput) {
    const customerId = await this.access.customerId(customerUserId);
    return this.signQuote(customerId, await this.buildQuote(this.prisma, customerId, input));
  }

  private async changedQuote(customerId: string, input: QuoteInput) {
    try {
      return new ConflictException({ code: 'QUOTE_CHANGED', message: 'Order details changed. Review and approve the current total.', ...this.signQuote(customerId, await this.buildQuote(this.prisma, customerId, input)) });
    } catch (error) {
      if (error instanceof ConflictException && (error.getResponse() as any)?.code === 'QUOTE_CHANGED') return error;
      return new ConflictException({ code: 'QUOTE_CHANGED', message: 'Order details changed. Refresh your basket and review checkout.' });
    }
  }

  async placeOrder(customerUserId: string, input: PlaceOrderInput) {
    // Older clients may omit the immutable request ID. Give each attempt its
    // own audit identity; the cart claim still prevents a double checkout.
    if (!input.requestId) input = { ...input, requestId: randomUUID() };
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerUserId },
      include: { user: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const replay = await this.existingCheckout(customerUserId, customer.id, input);
    if (replay) return replay;

    if (!input.approvedQuote) {
      throw new ConflictException({ code: 'QUOTE_REQUIRED', message: 'Review and approve the current order total before placing your order.' });
    }
    const approved = this.parseQuote(input.approvedQuote, customer.id);
    if (!Number.isFinite(Date.parse(approved.expiresAt)) || Date.parse(approved.expiresAt) <= Date.now()) {
      throw await this.changedQuote(customer.id, input);
    }
    try {
      const current = await this.buildQuote(this.prisma, customer.id, input);
      if (this.digest(current) !== approved.digest) throw await this.changedQuote(customer.id, input);
    } catch (error) {
      if (error instanceof ConflictException && (error.getResponse() as any)?.code === 'QUOTE_CHANGED') throw error;
      throw await this.changedQuote(customer.id, input);
    }

    const cart = await this.prisma.cart.findFirst({
      where: { id: input.cartId, customerId: customer.id, status: 'ACTIVE' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!cart && input.cartId)
      throw new ConflictException(
        'This checkout basket is no longer active. Check your orders before retrying.',
      );
    if (!cart || cart.items.length === 0) throw new BadRequestException('Your cart is empty');

    const address = await this.prisma.customerAddress.findFirst({
      where: { id: input.deliveryAddressId, customerId: customer.id },
    });
    if (!address) throw new BadRequestException('Delivery address not found');

    const allMethods = [PaymentMethod.COD] as string[];
    if (!allMethods.includes(input.paymentMethod)) {
      throw new BadRequestException('Unsupported payment method');
    }

    // Load and validate every line item against live merchant/product state.
    const merchantProducts = await this.prisma.merchantProduct.findMany({
      where: { id: { in: cart.items.map((i) => i.merchantProductId) } },
      include: { product: true, merchant: { include: { operatingHours: true } } },
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
      if (!isMerchantOpenAt(m.operatingHours, m.openingTime, m.closingTime)) {
        throw new BadRequestException(`${m.shopName} is outside its posted delivery hours`);
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
        categoryIds: merchantProducts.map((mp) => mp.product.categoryId),
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

    let result: { parentId: string | null; childOrders: any[] };
    try {
      result = await serializable(this.prisma, async (tx) => {
        await lockOwners(tx, { customerIds: [customer.id] });
        const committedQuote = await this.buildQuote(tx, customer.id, input);
        if (this.digest(committedQuote) !== approved.digest || Date.parse(approved.expiresAt) <= Date.now()) {
          throw new ConflictException({ code: 'QUOTE_CHANGED', message: 'Order details changed. Review and approve the current total.' });
        }
        // The write projection below was loaded outside this transaction. It
        // must equal the transaction's signed snapshot even if a listing or
        // cart changed and changed back between those reads.
        const persistedProjection = {
          cartId: cart.id,
          paymentMethod: input.paymentMethod,
          deliveryAddress: { id: address.id, fullAddress: address.fullAddress, city: address.city, latitude: address.latitude, longitude: address.longitude },
          items: perMerchant.flatMap((g) => g.lines.map((line) => ({
            merchantProductId: line.mp.id, productId: line.mp.productId, merchantId: g.merchantId,
            name: line.mp.product.name, quantity: line.cartItem.quantity, unitPricePaisa: line.unitPricePaisa,
          }))).sort((a, b) => a.merchantProductId.localeCompare(b.merchantProductId)),
          merchants: perMerchant.map((g) => ({ merchantId: g.merchantId, shopName: g.merchant.shopName, subtotalPaisa: g.subtotalPaisa, deliveryFeePaisa: g.deliveryFeePaisa }))
            .sort((a, b) => a.merchantId.localeCompare(b.merchantId)),
          subtotalPaisa: totalSubtotal, deliveryFeePaisa: totalDeliveryFee, serviceFeePaisa, smallOrderFeePaisa,
          discountPaisa, couponCode: couponCode ?? null, totalAmountPaisa: grandTotalPaisa,
        };
        if (this.digest(persistedProjection) !== this.digest(committedQuote)) {
          throw new ConflictException({ code: 'QUOTE_CHANGED', message: 'Order details changed. Review and approve the current total.' });
        }
        const liveMerchants = await tx.merchant.findMany({ where: { id: { in: perMerchant.map((g) => g.merchantId) } } });
        if (perMerchant.some((g) => {
          const live = liveMerchants.find((merchant) => merchant.id === g.merchantId);
          return !live || this.pricing.commissionPaisa(live, g.subtotalPaisa) !== g.commissionPaisa;
        })) throw new ConflictException({ code: 'QUOTE_CHANGED', message: 'Shop terms changed. Review this order again.' });
        // Fence the same basket before stock/payment writes, including requests
        // from older clients without a requestId. Rollback releases the claim.
        const claimed = await tx.cart.updateMany({
          where: { id: cart.id, customerId: customer.id, status: 'ACTIVE' },
          data: { status: 'CHECKED_OUT' },
        });
        if (claimed.count !== 1)
          throw new ConflictException('Checkout already started for this basket. Check your orders.');
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
              id: input.requestId,
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
          const childTotal = isMulti ? g.subtotalPaisa + g.deliveryFeePaisa : grandTotalPaisa;
          const order = await tx.order.create({
            data: {
              id: isMulti ? undefined : input.requestId,
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
              {
                orderId: order.id,
                status: OrderStatus.CREATED,
                changedByUserId: customerUserId,
                changedByRole: 'CUSTOMER',
              },
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

        await tx.auditLog.create({
          data: {
            id: `checkout:${input.requestId}`,
            userId: customerUserId,
            role: 'CUSTOMER',
            action: 'CHECKOUT_CREATED',
            entityType: 'Order',
            entityId: paymentAnchorId,
            newValue: JSON.stringify({
              cartId: input.cartId,
              fingerprint: this.digest({ cartId: input.cartId, deliveryAddressId: input.deliveryAddressId, paymentMethod: input.paymentMethod, customerNote: input.customerNote ?? '', couponCode: input.couponCode ?? null, approvedQuote: input.approvedQuote }),
            }),
          },
        });

        return { parentId, childOrders };
      });
    } catch (cause) {
      // A concurrent retry may lose the cart claim / unique ID race. Only
      // return an order owned by this customer with the original intent.
      const replay = await this.existingCheckout(customerUserId, customer.id, input);
      if (replay) return replay;
      throw cause;
    }

    // Post-commit notifications + realtime (only when already sent to merchants).
    if (!isOnlinePayment) {
      await this.announceToMerchants(result.childOrders, customer.user.fullName ?? 'A customer')
        .catch((error) => this.logger.warn(`Post-commit merchant notification failed: ${error}`));
    }
    await this.notifications.notify({
      userId: customerUserId,
      audience: 'CUSTOMER', scopeId: customerUserId,
      title: 'Order placed',
      body: isOnlinePayment
        ? 'Complete the payment to send your order to the shop.'
        : 'Your order was sent to the shop. We will notify you when it is accepted.',
      type: NotificationType.ORDER_PLACED,
      referenceId: result.parentId ?? result.childOrders[0].id,
    }).catch((error) => this.logger.warn(`Post-commit customer notification failed: ${error}`));

    return this.detailForCustomer(customerUserId, result.parentId ?? result.childOrders[0].id);
  }

  private async existingCheckout(customerUserId: string, customerId: string, input: PlaceOrderInput) {
    if (!input.requestId) return null;
    const order = await this.prisma.order.findUnique({ where: { id: input.requestId } });
    if (!order) return null;
    const audit = await this.prisma.auditLog.findUnique({ where: { id: `checkout:${input.requestId}` } });
    if (audit?.action === 'CHECKOUT_CREATED') {
      let recorded: { cartId?: string; fingerprint?: string } = {};
      try { recorded = JSON.parse(audit.newValue ?? '{}'); } catch { /* malformed legacy metadata fails closed */ }
      const fingerprint = this.digest({ cartId: input.cartId, deliveryAddressId: input.deliveryAddressId, paymentMethod: input.paymentMethod, customerNote: input.customerNote ?? '', couponCode: input.couponCode ?? null, approvedQuote: input.approvedQuote });
      if (order.customerId !== customerId || order.channel !== 'ONLINE' || recorded.cartId !== input.cartId || recorded.fingerprint !== fingerprint) {
        throw new ConflictException('Checkout reference cannot be reused. Check your orders before retrying.');
      }
      return this.detailForCustomer(customerUserId, order.id);
    }
    if (
      order.customerId !== customerId ||
      order.channel !== 'ONLINE' ||
      order.deliveryAddressId !== input.deliveryAddressId ||
      order.paymentMethod !== input.paymentMethod ||
      (order.customerNote ?? '') !== (input.customerNote ?? '') ||
      (input.couponCode !== undefined && order.couponCode !== input.couponCode)
    ) {
      throw new ConflictException('Checkout reference cannot be reused. Check your orders before retrying.');
    }
    return this.detailForCustomer(customerUserId, order.id);
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

  private async announceToMerchants(
    orders: { id: string; merchantId: string | null; orderNumber: string; totalAmountPaisa: number }[],
    customerName: string,
  ) {
    for (const order of orders) {
      if (!order.merchantId) continue;
      const userIds = await this.access.merchantUserIds(order.merchantId);
      await this.notifications.notifyMany(userIds, {
        audience: 'MERCHANT', scopeId: order.merchantId,
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
        rider: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            vehicleType: true,
            vehicleNumber: true,
            profileImageUrl: true,
          },
        },
        payments: true,
        refunds: true,
        children: {
          include: {
            items: true,
            timeline: { orderBy: { createdAt: 'asc' } },
            merchant: { select: { id: true, shopName: true, logoUrl: true, phoneNumber: true } },
            rider: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                vehicleType: true,
                vehicleNumber: true,
                profileImageUrl: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const orderIds = [order.id, ...(order.children ?? []).map((child) => child.id)];
    const revisions = await this.prisma.orderRevision.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'desc' },
      take: Math.max(orderIds.length * 10, 10),
      select: { id: true, orderId: true, status: true, originalTotalPaisa: true, proposedTotalPaisa: true, payload: true, createdAt: true, expiresAt: true, resolvedAt: true },
    });
    const attach = (target: any) => {
      const history = revisions.filter((revision) => revision.orderId === target.id).map(({ payload, ...revision }) => ({ ...revision, ...this.publicRevisionPayload(payload) }));
      return { ...target, orderRevisions: history, pendingRevision: history.find((revision) => revision.status === 'PENDING') ?? null };
    };
    order.children = (order.children ?? []).map(attach);
    Object.assign(order, attach(order));
    return this.redactOtp(order);
  }

  private publicRevisionPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { changes: [] };
    const value = payload as Record<string, any>;
    return {
      originalSubtotalPaisa: value.originalSubtotalPaisa ?? null,
      proposedSubtotalPaisa: value.proposedSubtotalPaisa ?? null,
      originalParentTotalPaisa: value.originalParentTotalPaisa ?? null,
      proposedParentTotalPaisa: value.proposedParentTotalPaisa ?? null,
      changes: Array.isArray(value.changes) ? value.changes : [],
    };
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
    const { order, targets, changes, refund } = await serializable(this.prisma, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, customerId }, include: { children: true } });
      if (!order) throw new NotFoundException('Order not found');
      const targets = order.isParent ? order.children : [order];
      if (targets.some((target) => !CUSTOMER_CANCELLABLE.includes(target.status))) {
        throw new BadRequestException('Order can no longer be cancelled — the shop has already accepted it. Contact support.');
      }
      const changes: Array<Awaited<ReturnType<OrderStatusService['applyInTransaction']>>> = [];
      for (const child of [...targets].sort((a, b) => a.id.localeCompare(b.id))) {
        const changed = await this.statusService.applyInTransaction(tx, child.id, OrderStatus.CANCELLED_BY_CUSTOMER, { userId: customerUserId, role: 'CUSTOMER', notes: reason }, { cancellationReason: reason ?? 'Cancelled by customer', cancelledAt: new Date() }, CUSTOMER_CANCELLABLE);
        await this.restoreStockInTransaction(tx, child.id);
        changes.push(changed);
      }
      const refund = await this.refundIfPaidInTransaction(tx, order.isParent ? order.id : targets[0].id, customerId, 'Order cancelled by customer');
      return { order, targets, changes, refund };
    });
    changes.forEach((change) => this.statusService.broadcastStatus(change));
    for (const child of targets) {
      if (child.merchantId) {
        const userIds = await this.access.merchantUserIds(child.merchantId);
        await this.notifications.notifyMany(userIds, {
          audience: 'MERCHANT', scopeId: child.merchantId,
          title: 'Order cancelled',
          body: `Order ${child.orderNumber} was cancelled by the customer.`,
          type: NotificationType.ORDER_CANCELLED,
          referenceId: child.id,
        }).catch((error) => this.logger.warn(`Post-commit cancellation notification failed: ${error}`));
      }
    }
    if (refund) await this.refunds.notifyCompleted(refund);
    return this.detailForCustomer(customerUserId, orderId);
  }

  async cancelByAdmin(adminUserId: string, orderId: string, reason: string) {
    const result = await serializable(this.prisma, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { children: true, customer: { select: { userId: true } } } });
      if (!order) throw new NotFoundException('Order not found');
      const children = order.isParent ? order.children : [order];
      const terminal = [OrderStatus.DELIVERED, ...CANCELLED_ORDER_STATUSES] as string[];
      const targets = children.filter((child) => !terminal.includes(child.status)).sort((a, b) => a.id.localeCompare(b.id));
      if (!targets.length) throw new BadRequestException('Order is already completed or cancelled');
      const changes = [] as Array<Awaited<ReturnType<OrderStatusService['applyInTransaction']>>>;
      const returnReview = [] as Array<{ orderId: string; items: Array<{ merchantProductId: string; quantity: number }> }>;
      for (const child of targets) {
        const pickupEvidence = await tx.orderTimelineEntry.findFirst({
          where: { orderId: child.id, status: { in: [OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.RIDER_ARRIVED_AT_CUSTOMER] } },
          select: { id: true },
        });
        const pickedUp = !!child.pickedUpAt || !!pickupEvidence || ([OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.RIDER_ARRIVED_AT_CUSTOMER] as string[]).includes(child.status);
        if (pickedUp) {
          const goods = await tx.orderItem.findMany({ where: { orderId: child.id, itemStatus: 'CONFIRMED' }, select: { merchantProductId: true, quantity: true } });
          if (goods.length) returnReview.push({ orderId: child.id, items: goods });
        }
        changes.push(await this.statusService.applyInTransaction(tx, child.id, OrderStatus.CANCELLED_BY_ADMIN, { userId: adminUserId, role: 'ADMIN', notes: reason }, { cancellationReason: reason, cancelledAt: new Date() }, [child.status]));
        await this.restoreStockInTransaction(tx, child.id, pickedUp ? ['REPLACEMENT_SUGGESTED'] : ['CONFIRMED', 'REPLACEMENT_SUGGESTED']);
        if (child.riderId) {
          await tx.rider.updateMany({ where: { id: child.riderId, currentOrderId: child.id }, data: { currentOrderId: null, currentStatus: RiderStatus.IDLE } });
        }
      }
      const refunds = [] as any[];
      if (order.isParent && targets.length === children.length) {
        const refund = await this.refundIfPaidInTransaction(tx, order.id, order.customerId, `Admin cancellation: ${reason}`);
        if (refund) refunds.push(refund);
      } else {
        for (const child of targets) {
          const refund = await this.refundIfPaidInTransaction(tx, child.id, order.customerId, `Admin cancellation: ${reason}`);
          if (refund) refunds.push(refund);
        }
      }
      await tx.auditLog.create({ data: { userId: adminUserId, role: 'ADMIN', action: 'ORDER_CANCELLED_BY_ADMIN', entityType: 'Order', entityId: orderId, newValue: JSON.stringify({ reason, targetIds: targets.map((child) => child.id), refundIds: refunds.map((refund) => refund.id), stockDisposition: returnReview.length ? 'RETURN_REVIEW_REQUIRED' : 'RESTORED_PRE_PICKUP', returnReview }) } });
      return { order, changes, refunds, returnReview };
    });
    result.changes.forEach((change) => this.statusService.broadcastStatus(change));
    await this.notifications.notify({ userId: result.order.customer.userId, audience: 'CUSTOMER', scopeId: result.order.customer.userId, title: 'Order cancelled', body: `Order ${result.order.orderNumber} was cancelled by SirfBazar: ${reason}. Any collected payment will be refunded.`, type: NotificationType.ORDER_CANCELLED, referenceId: result.order.id })
      .catch((error) => this.logger.warn(`Post-commit admin cancellation notification failed: ${error}`));
    for (const refund of result.refunds) await this.refunds.notifyCompleted(refund);
    return { ok: true, status: OrderStatus.CANCELLED_BY_ADMIN, returnReviewRequired: result.returnReview.length > 0, returnReview: result.returnReview };
  }

  /** Restores stock for all confirmed items of an order (spec 12.8). */
  async restoreStock(orderId: string) {
    return serializable(this.prisma, (tx) => this.restoreStockInTransaction(tx, orderId));
  }

  async restoreStockInTransaction(tx: Prisma.TransactionClient, orderId: string, statuses: string[] = ['CONFIRMED', 'REPLACEMENT_SUGGESTED']) {
    const items = await tx.orderItem.findMany({
      where: { orderId, itemStatus: { in: statuses } },
      orderBy: { merchantProductId: 'asc' },
    });
    for (const item of items) {
      await tx.merchantProduct.update({ where: { id: item.merchantProductId }, data: { stockQuantity: { increment: item.quantity } } });
    }
  }

  /** Auto-refund of online payments when an order dies before fulfilment. */
  async refundIfPaid(orderId: string, customerId: string, reason: string) {
    const refund = await serializable(this.prisma, (tx) => this.refundIfPaidInTransaction(tx, orderId, customerId, reason));
    if (refund) await this.refunds.notifyCompleted(refund);
    return refund;
  }

  async notifyCompletedRefund(refund: any) {
    await this.refunds.notifyCompleted(refund);
  }

  async refundIfPaidInTransaction(tx: Prisma.TransactionClient, orderId: string, customerId: string, reason: string) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customerId) return;
    const anchorOrderId = order.parentOrderId ?? order.id;
    const payment = await tx.payment.findFirst({
      where: { orderId: anchorOrderId, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] } },
    });
    if (!payment) return;
    return this.refunds.createInTransaction(tx, {
      orderId,
      customerId,
      amountPaisa: order.isParent ? payment.amountPaisa : Math.min(payment.amountPaisa, order.totalAmountPaisa),
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

  async respondToReplacement(customerUserId: string, orderId: string, itemId: string, accept: boolean) {
    const customerId = await this.access.customerId(customerUserId);
    const { order, original } = await serializable(this.prisma, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, customerId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if ([OrderStatus.DELIVERED, ...CANCELLED_ORDER_STATUSES].includes(order.status as any)) throw new ConflictException('Order is no longer active');
      const suggestion = order.items.find((item) => item.replacementForItemId === itemId && item.itemStatus === 'REPLACEMENT_SUGGESTED');
      const original = order.items.find((item) => item.id === itemId && item.itemStatus === 'UNAVAILABLE');
      if (!suggestion || !original) throw new NotFoundException('No pending replacement for this item');
      const claimed = await tx.orderItem.updateMany({ where: { id: suggestion.id, itemStatus: 'REPLACEMENT_SUGGESTED' }, data: { itemStatus: accept ? 'CONFIRMED' : 'REMOVED' } });
      if (claimed.count !== 1) throw new ConflictException('Replacement was already answered');
      if (accept) await tx.orderItem.update({ where: { id: original.id }, data: { itemStatus: 'REPLACED' } });
      else await tx.merchantProduct.update({ where: { id: suggestion.merchantProductId }, data: { stockQuantity: { increment: suggestion.quantity } } });
      await this.recomputeOrderTotals(order.id, tx);
      await this.statusService.appendTimeline(order.id, 'REPLACEMENT_' + (accept ? 'ACCEPTED' : 'REJECTED'), { userId: customerUserId, role: 'CUSTOMER', notes: `Item ${original.productNameSnapshot}` }, tx);
      return { order, original };
    });
    if (order.merchantId) {
      const userIds = await this.access.merchantUserIds(order.merchantId);
      await this.notifications.notifyMany(userIds, {
        audience: 'MERCHANT', scopeId: order.merchantId,
        title: accept ? 'Replacement accepted' : 'Replacement rejected',
        body: `Customer ${accept ? 'accepted' : 'rejected'} the replacement for ${original.productNameSnapshot} on order ${order.orderNumber}.`,
        type: NotificationType.REPLACEMENT_REQUESTED,
        referenceId: order.id,
      }).catch((error) => this.logger.warn(`Post-commit replacement notification failed: ${error}`));
    }
    return this.detailForCustomer(customerUserId, orderId);
  }

  async respondToRevision(customerUserId: string, orderId: string, revisionId: string, accept: boolean) {
    const customerId = await this.access.customerId(customerUserId);
    const result = await serializable(this.prisma, async (tx) => {
      const revision = await tx.orderRevision.findFirst({
        where: { id: revisionId, orderId, order: { customerId } },
        include: { order: { include: { items: true, parent: true, customer: { select: { userId: true } } } } },
      });
      if (!revision) throw new NotFoundException('Order revision not found');
      if (revision.status !== 'PENDING') throw new ConflictException('This order revision has already been resolved.');
      const now = new Date();
      if (revision.expiresAt <= now) {
        const expired = await tx.orderRevision.updateMany({ where: { id: revision.id, status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'EXPIRED', resolvedAt: now } });
        if (expired.count === 1) await this.statusService.appendTimeline(orderId, 'ORDER_REVISION_EXPIRED', { role: 'SYSTEM', notes: 'Customer approval window elapsed; original order retained' }, tx);
        return { status: 'EXPIRED', merchantId: revision.order.merchantId, orderNumber: revision.order.orderNumber };
      }

      const order = revision.order;
      if (!order.merchantId) throw new ConflictException('Parent orders cannot be revised directly.');
      const merchantId = order.merchantId;
      const revisionStatuses: string[] = [OrderStatus.SENT_TO_MERCHANT, OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING];
      const canResolve = order.paymentMethod === PaymentMethod.COD && !order.riderId &&
        revisionStatuses.includes(order.status);
      if (!canResolve) {
        const closed = await tx.orderRevision.updateMany({ where: { id: revision.id, status: 'PENDING' }, data: { status: 'REJECTED', resolvedAt: now, resolvedByUserId: customerUserId } });
        if (closed.count !== 1) throw new ConflictException('Order revision changed. Refresh the order.');
        await this.statusService.appendTimeline(orderId, 'ORDER_REVISION_REJECTED', { userId: customerUserId, role: 'SYSTEM', notes: 'Order state no longer permits the proposed change; original order retained' }, tx);
        return { status: 'REJECTED', merchantId: order.merchantId, orderNumber: order.orderNumber };
      }

      if (!accept) {
        const rejected = await tx.orderRevision.updateMany({ where: { id: revision.id, status: 'PENDING', expiresAt: { gt: now } }, data: { status: 'REJECTED', resolvedAt: now, resolvedByUserId: customerUserId } });
        if (rejected.count !== 1) throw new ConflictException('Order revision changed. Refresh the order.');
        await this.statusService.appendTimeline(orderId, 'ORDER_REVISION_REJECTED', { userId: customerUserId, role: 'CUSTOMER', notes: 'Customer rejected the proposed changes; original order retained' }, tx);
        return { status: 'REJECTED', merchantId: order.merchantId, orderNumber: order.orderNumber };
      }

      const payload = revision.payload as any;
      if (!Array.isArray(payload?.changes) || payload.changes.length === 0) throw new ConflictException('Revision details are invalid. Contact support before fulfillment.');
      for (const change of payload.changes) {
        const original = order.items.find((item) => item.id === change.originalItemId && item.itemStatus === 'CONFIRMED');
        if (!original || original.quantity !== change.original?.quantity || original.totalPricePaisa !== change.original?.totalPricePaisa) {
          throw new ConflictException('Order items changed since this proposal. The original order is unchanged.');
        }
        if (change.action === 'REMOVE') {
          const removed = await tx.orderItem.updateMany({ where: { id: original.id, orderId, itemStatus: 'CONFIRMED', quantity: original.quantity }, data: { itemStatus: 'REMOVED' } });
          if (removed.count !== 1) throw new ConflictException('Order item changed. Refresh the order.');
          const stock = await tx.merchantProduct.updateMany({ where: { id: original.merchantProductId, merchantId }, data: { stockQuantity: { increment: original.quantity } } });
          if (stock.count !== 1) throw new ConflictException('Original inventory changed. Contact support before fulfillment.');
        } else if (change.action === 'REDUCE') {
          const proposedQuantity = Number(change.proposed?.quantity);
          if (!Number.isSafeInteger(proposedQuantity) || proposedQuantity < 1 || proposedQuantity >= original.quantity) throw new ConflictException('Proposed quantity is invalid.');
          const reduced = await tx.orderItem.updateMany({ where: { id: original.id, orderId, itemStatus: 'CONFIRMED', quantity: original.quantity }, data: { quantity: proposedQuantity, totalPricePaisa: original.unitPricePaisa * proposedQuantity } });
          if (reduced.count !== 1) throw new ConflictException('Order item changed. Refresh the order.');
          const stock = await tx.merchantProduct.updateMany({ where: { id: original.merchantProductId, merchantId }, data: { stockQuantity: { increment: original.quantity - proposedQuantity } } });
          if (stock.count !== 1) throw new ConflictException('Original inventory changed. Contact support before fulfillment.');
        } else if (change.action === 'REPLACE') {
          const proposed = change.proposed;
          const quantity = Number(proposed?.quantity);
          if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > original.quantity) throw new ConflictException('Replacement quantity is invalid.');
          const stockClaim = await tx.merchantProduct.updateMany({
            where: {
              id: proposed.merchantProductId,
              merchantId,
              isAvailable: true,
              stockQuantity: { gte: quantity },
              pricePaisa: proposed.pricePaisa,
              discountPricePaisa: proposed.discountPricePaisa,
              product: { approvalStatus: 'APPROVED', isRestricted: false, requiresPrescription: false, category: { isRestricted: false, isActive: true } },
            },
            data: { stockQuantity: { decrement: quantity } },
          });
          if (stockClaim.count !== 1) throw new ConflictException('Replacement stock or price changed. Ask the shop to send a new proposal.');
          const replaced = await tx.orderItem.updateMany({ where: { id: original.id, orderId, itemStatus: 'CONFIRMED', quantity: original.quantity }, data: { itemStatus: 'REPLACED' } });
          if (replaced.count !== 1) throw new ConflictException('Order item changed. Refresh the order.');
          const oldStock = await tx.merchantProduct.updateMany({ where: { id: original.merchantProductId, merchantId }, data: { stockQuantity: { increment: original.quantity } } });
          if (oldStock.count !== 1) throw new ConflictException('Original inventory changed. Contact support before fulfillment.');
          await tx.orderItem.create({ data: {
            orderId,
            productId: proposed.productId,
            merchantProductId: proposed.merchantProductId,
            productNameSnapshot: proposed.name,
            productImageSnapshot: proposed.imageUrl,
            unitSnapshot: proposed.unit,
            quantity,
            unitPricePaisa: proposed.unitPricePaisa,
            totalPricePaisa: proposed.totalPricePaisa,
            itemStatus: 'CONFIRMED',
            replacementForItemId: original.id,
          } });
        } else {
          throw new ConflictException('Revision contains an unsupported item action.');
        }
      }

      const proposedSubtotal = Number(payload.proposedSubtotalPaisa);
      if (!Number.isSafeInteger(proposedSubtotal) || proposedSubtotal < 0) throw new ConflictException('Revision subtotal is invalid.');
      if (!order.parentOrderId) await tx.order.update({ where: { id: orderId }, data: { smallOrderFeePaisa: this.pricing.smallOrderFeePaisa(proposedSubtotal) } });
      await this.recomputeOrderTotals(orderId, tx);
      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (updatedOrder.totalAmountPaisa !== revision.proposedTotalPaisa) throw new ConflictException('Revised total did not match the approved proposal. The original order is unchanged.');
      if (order.parentOrderId && payload.proposedParentTotalPaisa != null) {
        const updatedParent = await tx.order.findUniqueOrThrow({ where: { id: order.parentOrderId } });
        if (updatedParent.totalAmountPaisa !== Number(payload.proposedParentTotalPaisa)) throw new ConflictException('Combined order total changed. The original order is unchanged.');
      }
      const approved = await tx.orderRevision.updateMany({ where: { id: revision.id, status: 'PENDING', expiresAt: { gt: now } }, data: { status: 'APPROVED', resolvedAt: now, resolvedByUserId: customerUserId } });
      if (approved.count !== 1) throw new ConflictException('Revision expired or changed. Refresh the order.');
      await this.statusService.appendTimeline(orderId, 'ORDER_REVISION_APPROVED', { userId: customerUserId, role: 'CUSTOMER', notes: `Customer approved revised order total ${updatedOrder.totalAmountPaisa} paisa` }, tx);
      return { status: 'APPROVED', merchantId: order.merchantId, orderNumber: order.orderNumber };
    });

    if (result.merchantId && result.status !== 'EXPIRED') {
      const merchantUsers = await this.access.merchantUserIds(result.merchantId);
      await this.notifications.notifyMany(merchantUsers, {
        audience: 'MERCHANT', scopeId: result.merchantId,
        title: result.status === 'APPROVED' ? 'Order revision approved' : 'Order revision rejected',
        body: `The customer ${result.status === 'APPROVED' ? 'approved' : 'rejected'} the proposed changes for order ${result.orderNumber}.`,
        type: NotificationType.REPLACEMENT_REQUESTED,
        referenceId: orderId,
      }).catch((error) => this.logger.warn(`Post-commit revision response notification failed: ${error}`));
    }
    if (result.status === 'EXPIRED') throw new ConflictException('This proposal expired. The original order remains unchanged.');
    return this.detailForCustomer(customerUserId, orderId);
  }

  /** Re-derives money fields after item-level changes. */
  smallOrderFeeForSubtotal(subtotalPaisa: number) {
    return this.pricing.smallOrderFeePaisa(subtotalPaisa);
  }

  async recomputeOrderTotals(orderId: string, db: PrismaService | Prisma.TransactionClient = this.prisma) {
    const order = await db.order.findUnique({
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
      subtotal +
        order.deliveryFeePaisa +
        order.serviceFeePaisa +
        order.smallOrderFeePaisa -
        order.discountAmountPaisa,
    );
    await db.order.update({
      where: { id: orderId },
      data: {
        subtotalPaisa: subtotal,
        commissionAmountPaisa: commission,
        merchantEarningPaisa: subtotal - commission,
        totalAmountPaisa: total,
      },
    });
    if (order.parentOrderId) {
      const siblings = await db.order.findMany({ where: { parentOrderId: order.parentOrderId } });
      const parent = await db.order.findUnique({ where: { id: order.parentOrderId } });
      if (parent) {
        const subtotalSum = siblings.reduce((s, o) => s + o.subtotalPaisa, 0);
        const deliverySum = siblings.reduce((s, o) => s + o.deliveryFeePaisa, 0);
        await db.order.update({
          where: { id: parent.id },
          data: {
            subtotalPaisa: subtotalSum,
            deliveryFeePaisa: deliverySum,
            smallOrderFeePaisa: this.pricing.smallOrderFeePaisa(subtotalSum),
            totalAmountPaisa: Math.max(
              0,
              subtotalSum +
                deliverySum +
                parent.serviceFeePaisa +
                this.pricing.smallOrderFeePaisa(subtotalSum) -
                parent.discountAmountPaisa,
            ),
          },
        });
      }
    }
  }

  // ── Merchant acceptance timeout (spec 20.5) ────────────────────────────────

  onModuleInit() {
    const minutes = Number(process.env.MERCHANT_ACCEPT_TIMEOUT_MINUTES || 10);
    if (minutes > 0) {
      this.timeoutTimer = setInterval(() => {
        this.expireUnacceptedOrders(minutes).catch((err) => this.logger.warn(`Timeout sweep failed: ${err}`));
      }, 60_000);
      this.timeoutTimer.unref?.();
    }
    this.revisionTimer = setInterval(() => {
      this.expirePendingOrderRevisions().catch((err) => this.logger.warn(`Order revision expiry sweep failed: ${err}`));
    }, 15_000);
    this.revisionTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.timeoutTimer) clearInterval(this.timeoutTimer);
    if (this.revisionTimer) clearInterval(this.revisionTimer);
  }

  async expirePendingOrderRevisions() {
    const now = new Date();
    const stale = await this.prisma.orderRevision.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      include: { order: { select: { id: true, orderNumber: true, merchantId: true, customer: { select: { userId: true } } } } },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
    for (const revision of stale) {
      try {
        const expired = await serializable(this.prisma, async (tx) => {
          const result = await tx.orderRevision.updateMany({ where: { id: revision.id, status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'EXPIRED', resolvedAt: now } });
          if (result.count !== 1) return false;
          await this.statusService.appendTimeline(revision.orderId, 'ORDER_REVISION_EXPIRED', { role: 'SYSTEM', notes: 'Customer approval window elapsed; original order retained' }, tx);
          return true;
        });
        if (!expired) continue;
        await this.notifications.notify({
          userId: revision.order.customer.userId,
          audience: 'CUSTOMER', scopeId: revision.order.customer.userId,
          title: 'Order proposal expired',
          body: `The proposed changes to order ${revision.order.orderNumber} expired. Your original order remains unchanged.`,
          type: NotificationType.REPLACEMENT_REQUESTED,
          referenceId: revision.orderId,
        }).catch(() => undefined);
        if (revision.order.merchantId) {
          const merchantUsers = await this.access.merchantUserIds(revision.order.merchantId);
          await this.notifications.notifyMany(merchantUsers, {
            audience: 'MERCHANT', scopeId: revision.order.merchantId,
            title: 'Order proposal expired', body: `The customer did not respond to the proposal for order ${revision.order.orderNumber}. The original order remains unchanged.`,
            type: NotificationType.REPLACEMENT_REQUESTED, referenceId: revision.orderId,
          }).catch(() => undefined);
        }
      } catch (error) {
        this.logger.warn(`Could not expire order revision ${revision.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
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
      let changed;
      let refund;
      try {
        ({ changed, refund } = await serializable(this.prisma, async (tx) => {
          const result = await this.statusService.applyInTransaction(tx, order.id, OrderStatus.MERCHANT_REJECTED, { role: 'SYSTEM', notes: `Shop did not respond within ${timeoutMinutes} minutes` }, { cancellationReason: 'Merchant did not respond in time', cancelledAt: new Date() }, [OrderStatus.SENT_TO_MERCHANT]);
          await this.restoreStockInTransaction(tx, order.id);
          const refund = await this.refundIfPaidInTransaction(tx, order.id, order.customerId, 'Merchant did not respond in time');
          return { changed: result, refund };
        }));
      } catch (error) {
        if (error instanceof ConflictException) continue;
        throw error;
      }
      this.statusService.broadcastStatus(changed);
      await this.notifications.notify({
        userId: order.customer.userId,
        audience: 'CUSTOMER', scopeId: order.customer.userId,
        title: 'Order not accepted',
        body: `The shop did not respond to order ${order.orderNumber} in time. Any payment will be refunded.`,
        type: NotificationType.ORDER_TIMEOUT,
        referenceId: order.id,
      }).catch((error) => this.logger.warn(`Post-commit timeout notification failed: ${error}`));
      if (refund) await this.refunds.notifyCompleted(refund);
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
