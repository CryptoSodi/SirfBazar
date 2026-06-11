import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { PricingService } from '../common/pricing.service';
import { haversineKm } from '../common/utils/geo';
import { MerchantApprovalStatus } from '../common/constants';

export interface CartOwner {
  customerId?: string;
  guestSessionId?: string;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    private readonly pricing: PricingService,
  ) {}

  // ── Owner resolution ───────────────────────────────────────────────────────

  async ownerFromGuestToken(token?: string): Promise<CartOwner> {
    if (!token) throw new UnauthorizedException('x-guest-session header required');
    const session = await this.prisma.guestSession.findUnique({ where: { sessionToken: token } });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Guest session expired — create a new one');
    }
    return { guestSessionId: session.id };
  }

  async ownerFromCustomerUser(userId: string): Promise<CartOwner> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new NotFoundException('Customer profile not found');
    return { customerId: customer.id };
  }

  // ── Cart CRUD ──────────────────────────────────────────────────────────────

  async getOrCreateActiveCart(owner: CartOwner) {
    const where = owner.customerId
      ? { customerId: owner.customerId, status: 'ACTIVE' }
      : { guestSessionId: owner.guestSessionId, status: 'ACTIVE' };
    const existing = await this.prisma.cart.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (existing) return existing;
    return this.prisma.cart.create({
      data: {
        customerId: owner.customerId ?? null,
        guestSessionId: owner.guestSessionId ?? null,
      },
    });
  }

  async addItem(owner: CartOwner, merchantProductId: string, quantity: number) {
    if (quantity < 1) throw new BadRequestException('Quantity must be at least 1');
    const mp = await this.loadSellableMerchantProduct(merchantProductId);

    const cart = await this.getOrCreateActiveCart(owner);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_merchantProductId: { cartId: cart.id, merchantProductId } },
    });

    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > mp.stockQuantity) {
      throw new BadRequestException(`Only ${mp.stockQuantity} in stock at this shop`);
    }

    const unitPricePaisa = mp.discountPricePaisa ?? mp.pricePaisa;
    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty, unitPricePaisa },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          merchantId: mp.merchantId,
          productId: mp.productId,
          merchantProductId,
          quantity,
          unitPricePaisa,
        },
      });
    }
    await this.prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
    return this.view(owner);
  }

  async updateItem(owner: CartOwner, itemId: string, quantity: number) {
    const cart = await this.getOrCreateActiveCart(owner);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const mp = await this.loadSellableMerchantProduct(item.merchantProductId);
      if (quantity > mp.stockQuantity) {
        throw new BadRequestException(`Only ${mp.stockQuantity} in stock at this shop`);
      }
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity, unitPricePaisa: mp.discountPricePaisa ?? mp.pricePaisa },
      });
    }
    return this.view(owner);
  }

  async removeItem(owner: CartOwner, itemId: string) {
    const cart = await this.getOrCreateActiveCart(owner);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.view(owner);
  }

  async clear(owner: CartOwner) {
    const cart = await this.getOrCreateActiveCart(owner);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return this.view(owner);
  }

  async applyCoupon(owner: CartOwner, code: string) {
    const cart = await this.getOrCreateActiveCart(owner);
    const items = await this.prisma.cartItem.findMany({ where: { cartId: cart.id } });
    if (items.length === 0) throw new BadRequestException('Cart is empty');

    const subtotal = items.reduce((sum, i) => sum + i.unitPricePaisa * i.quantity, 0);
    await this.coupons.validate({
      code,
      customerId: owner.customerId,
      subtotalPaisa: subtotal,
      merchantIds: [...new Set(items.map((i) => i.merchantId))],
    });
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: code.trim().toUpperCase() },
    });
    return this.view(owner);
  }

  async removeCoupon(owner: CartOwner) {
    const cart = await this.getOrCreateActiveCart(owner);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return this.view(owner);
  }

  /** Merge a guest cart into the customer's cart after login-at-checkout. */
  async mergeGuestCart(guestToken: string, customerUserId: string) {
    const guestOwner = await this.ownerFromGuestToken(guestToken);
    const customerOwner = await this.ownerFromCustomerUser(customerUserId);

    const guestCart = await this.prisma.cart.findFirst({
      where: { guestSessionId: guestOwner.guestSessionId, status: 'ACTIVE' },
      include: { items: true },
    });
    if (guestCart && guestCart.items.length > 0) {
      const customerCart = await this.getOrCreateActiveCart(customerOwner);
      for (const item of guestCart.items) {
        const existing = await this.prisma.cartItem.findUnique({
          where: {
            cartId_merchantProductId: {
              cartId: customerCart.id,
              merchantProductId: item.merchantProductId,
            },
          },
        });
        if (existing) {
          await this.prisma.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          });
        } else {
          await this.prisma.cartItem.create({
            data: {
              cartId: customerCart.id,
              merchantId: item.merchantId,
              productId: item.productId,
              merchantProductId: item.merchantProductId,
              quantity: item.quantity,
              unitPricePaisa: item.unitPricePaisa,
            },
          });
        }
      }
      if (guestCart.couponCode) {
        await this.prisma.cart.update({
          where: { id: customerCart.id },
          data: { couponCode: guestCart.couponCode },
        });
      }
      await this.prisma.cart.update({ where: { id: guestCart.id }, data: { status: 'MERGED' } });
    }
    return this.view(customerOwner);
  }

  // ── Cart view with price breakdown ─────────────────────────────────────────

  async view(owner: CartOwner, location?: { latitude: number; longitude: number }) {
    const cart = await this.getOrCreateActiveCart(owner);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
    });

    const mpIds = items.map((i) => i.merchantProductId);
    const merchantProducts = await this.prisma.merchantProduct.findMany({
      where: { id: { in: mpIds } },
      include: { product: true, merchant: true },
    });
    const mpById = new Map(merchantProducts.map((mp) => [mp.id, mp]));

    const groupsByMerchant = new Map<string, any>();
    for (const item of items) {
      const mp = mpById.get(item.merchantProductId);
      if (!mp) continue;
      let group = groupsByMerchant.get(item.merchantId);
      if (!group) {
        let distanceKm: number | null = null;
        if (location) {
          distanceKm =
            Math.round(
              haversineKm(location.latitude, location.longitude, mp.merchant.latitude, mp.merchant.longitude) * 10,
            ) / 10;
        }
        group = {
          merchant: {
            id: mp.merchant.id,
            shopName: mp.merchant.shopName,
            logoUrl: mp.merchant.logoUrl,
            city: mp.merchant.city,
            minimumOrderValuePaisa: mp.merchant.minimumOrderValuePaisa,
            isOnline: mp.merchant.isOnline,
            isOpen: mp.merchant.isOpen,
          },
          distanceKm,
          items: [],
          subtotalPaisa: 0,
          deliveryFeePaisa: this.pricing.deliveryFeePaisa(distanceKm),
        };
        groupsByMerchant.set(item.merchantId, group);
      }
      const currentPrice = mp.discountPricePaisa ?? mp.pricePaisa;
      group.items.push({
        id: item.id,
        merchantProductId: mp.id,
        productId: mp.productId,
        name: mp.product.name,
        imageUrl: mp.product.imageUrl,
        unit: mp.product.unit,
        size: mp.product.size,
        quantity: item.quantity,
        unitPricePaisa: currentPrice,
        totalPaisa: currentPrice * item.quantity,
        priceChanged: currentPrice !== item.unitPricePaisa,
        inStock: mp.isAvailable && mp.stockQuantity >= item.quantity,
        stockQuantity: mp.stockQuantity,
      });
      group.subtotalPaisa += currentPrice * item.quantity;
    }

    const groups = [...groupsByMerchant.values()];
    const subtotalPaisa = groups.reduce((s, g) => s + g.subtotalPaisa, 0);
    let deliveryFeePaisa = groups.reduce((s, g) => s + g.deliveryFeePaisa, 0);
    const serviceFeePaisa = items.length > 0 ? this.pricing.serviceFeePaisa() : 0;
    const smallOrderFeePaisa = items.length > 0 ? this.pricing.smallOrderFeePaisa(subtotalPaisa) : 0;

    let discountPaisa = 0;
    let couponError: string | null = null;
    if (cart.couponCode && items.length > 0) {
      try {
        const quote = await this.coupons.validate({
          code: cart.couponCode,
          customerId: owner.customerId,
          subtotalPaisa,
          merchantIds: [...groupsByMerchant.keys()],
        });
        discountPaisa = quote.discountPaisa;
        if (quote.freeDelivery) deliveryFeePaisa = 0;
      } catch (err: any) {
        couponError = err?.message ?? 'Coupon not applicable';
      }
    }

    return {
      id: cart.id,
      couponCode: cart.couponCode,
      couponError,
      groups,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      subtotalPaisa,
      deliveryFeePaisa,
      serviceFeePaisa,
      smallOrderFeePaisa,
      discountPaisa,
      totalPaisa: Math.max(
        0,
        subtotalPaisa + deliveryFeePaisa + serviceFeePaisa + smallOrderFeePaisa - discountPaisa,
      ),
    };
  }

  private async loadSellableMerchantProduct(merchantProductId: string) {
    const mp = await this.prisma.merchantProduct.findUnique({
      where: { id: merchantProductId },
      include: { merchant: true, product: true },
    });
    if (!mp) throw new NotFoundException('Product not found at this shop');
    if (!mp.isAvailable) throw new BadRequestException('Product is currently unavailable');
    if (mp.merchant.approvalStatus !== MerchantApprovalStatus.APPROVED) {
      throw new BadRequestException('This shop is not currently active');
    }
    if (mp.product.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('This product is not available');
    }
    return mp;
  }
}
