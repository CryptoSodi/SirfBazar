import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CouponQuote {
  couponId: string;
  code: string;
  discountPaisa: number;
  freeDelivery: boolean;
}

export interface CouponContext {
  code: string;
  customerId?: string;
  subtotalPaisa: number;
  merchantIds: string[];
  categoryIds?: string[];
  city?: string;
  paymentMethod?: string;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a coupon against the cart context and returns the discount.
   * Throws BadRequestException with a human-readable reason when not applicable.
   */
  async validate(ctx: CouponContext): Promise<CouponQuote> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: ctx.code.trim().toUpperCase() },
    });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Invalid coupon code');

    const now = new Date();
    if (coupon.startDate > now) throw new BadRequestException('Coupon is not active yet');
    if (coupon.endDate < now) throw new BadRequestException('Coupon has expired');

    if (ctx.subtotalPaisa < coupon.minimumOrderAmountPaisa) {
      throw new BadRequestException(
        `Minimum order of Rs ${(coupon.minimumOrderAmountPaisa / 100).toFixed(0)} required for this coupon`,
      );
    }

    if (coupon.applicableMerchantId && !ctx.merchantIds.includes(coupon.applicableMerchantId)) {
      throw new BadRequestException('Coupon is not valid for this shop');
    }
    if (
      coupon.applicableCategoryId &&
      ctx.categoryIds &&
      !ctx.categoryIds.includes(coupon.applicableCategoryId)
    ) {
      throw new BadRequestException('Coupon is not valid for these products');
    }
    if (coupon.applicableCity && ctx.city && coupon.applicableCity !== ctx.city) {
      throw new BadRequestException('Coupon is not valid in your city');
    }
    if (
      coupon.paymentMethodRestriction &&
      ctx.paymentMethod &&
      coupon.paymentMethodRestriction !== ctx.paymentMethod
    ) {
      throw new BadRequestException(`Coupon requires payment via ${coupon.paymentMethodRestriction}`);
    }

    if (coupon.usageLimitTotal != null) {
      const totalUses = await this.prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (totalUses >= coupon.usageLimitTotal) {
        throw new BadRequestException('Coupon usage limit reached');
      }
    }

    if (ctx.customerId) {
      const customerUses = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, customerId: ctx.customerId },
      });
      if (customerUses >= coupon.usageLimitPerCustomer) {
        throw new BadRequestException('You have already used this coupon');
      }
      if (coupon.newUsersOnly) {
        const orders = await this.prisma.order.count({
          where: { customerId: ctx.customerId, parentOrderId: null },
        });
        if (orders > 0) throw new BadRequestException('Coupon is for new customers only');
      }
    }

    let discountPaisa = 0;
    let freeDelivery = false;
    if (coupon.discountType === 'PERCENTAGE') {
      discountPaisa = Math.floor((ctx.subtotalPaisa * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmountPaisa != null) {
        discountPaisa = Math.min(discountPaisa, coupon.maxDiscountAmountPaisa);
      }
    } else if (coupon.discountType === 'FIXED') {
      discountPaisa = Math.min(Math.round(coupon.discountValue), ctx.subtotalPaisa);
    } else if (coupon.discountType === 'FREE_DELIVERY') {
      freeDelivery = true;
    }

    return { couponId: coupon.id, code: coupon.code, discountPaisa, freeDelivery };
  }

  async recordUsage(couponId: string, customerId: string, orderId: string, discountPaisa: number) {
    await this.prisma.couponUsage.create({
      data: { couponId, customerId, orderId, discountAmountPaisa: discountPaisa },
    });
  }

  /** Public list of currently active coupons (customer "offers" screens). */
  listActive() {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        maxDiscountAmountPaisa: true,
        minimumOrderAmountPaisa: true,
        endDate: true,
        newUsersOnly: true,
      },
    });
  }
}
