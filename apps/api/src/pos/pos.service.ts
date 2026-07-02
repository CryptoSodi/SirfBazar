import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { OrderStatus, PaymentStatus, StaffPermission, UserRole } from '../common/constants';
import { generateOrderNumber } from '../common/utils/ids';

interface SaleItemInput {
  merchantProductId: string;
  quantity: number;
}
interface CreateSaleInput {
  items: SaleItemInput[];
  amountTenderedPaisa?: number;
  note?: string;
}

/** Sentinel identity every POS (walk-in) order is attached to; never dialled. */
const WALKIN_PHONE = 'POS-WALKIN';

/**
 * In-store point-of-sale. A cash sale decrements the SAME MerchantProduct stock
 * the online marketplace draws from, and is recorded as a channel=POS Order so it
 * flows into the merchant's sales history — but with commission 0 and excluded
 * from settlements (the shop already holds the cash).
 */
@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Products in the merchant's own store, for the register grid. */
  async listProducts(userId: string, q?: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);

    const where: any = { merchantId: ctx.merchantId };
    if (q) where.product = { name: { contains: q, mode: 'insensitive' } };

    const rows = await this.prisma.merchantProduct.findMany({
      where,
      include: { product: { select: { name: true, imageUrl: true, unit: true, barcode: true } } },
      orderBy: { product: { name: 'asc' } },
      take: 300,
    });
    return rows.map((r) => ({
      merchantProductId: r.id,
      productId: r.productId,
      name: r.product.name,
      imageUrl: r.product.imageUrl,
      unit: r.product.unit,
      barcode: r.product.barcode,
      pricePaisa: r.discountPricePaisa ?? r.pricePaisa,
      stockQuantity: r.stockQuantity,
      isAvailable: r.isAvailable,
    }));
  }

  /** Ring up a cash sale: decrement unified stock + record a channel=POS order. */
  async createSale(userId: string, dto: CreateSaleInput) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);
    if (!dto.items?.length) throw new BadRequestException('Add at least one item to the sale');

    const ids = dto.items.map((i) => i.merchantProductId);
    const offers = await this.prisma.merchantProduct.findMany({
      where: { id: { in: ids }, merchantId: ctx.merchantId },
      include: { product: { select: { name: true, imageUrl: true, unit: true } } },
    });
    const byId = new Map(offers.map((o) => [o.id, o]));

    const lines = dto.items.map((i) => {
      const offer = byId.get(i.merchantProductId);
      if (!offer) throw new NotFoundException('One of the products is not in your store');
      const qty = Math.floor(i.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException(`Invalid quantity for ${offer.product.name}`);
      }
      if (offer.stockQuantity < qty) {
        throw new BadRequestException(`Only ${offer.stockQuantity} of ${offer.product.name} left in stock`);
      }
      const unitPricePaisa = offer.discountPricePaisa ?? offer.pricePaisa;
      return { offer, qty, unitPricePaisa, totalPricePaisa: unitPricePaisa * qty };
    });

    const subtotalPaisa = lines.reduce((s, l) => s + l.totalPricePaisa, 0);
    const tendered = dto.amountTenderedPaisa ?? subtotalPaisa;
    if (tendered < subtotalPaisa) throw new BadRequestException('Cash tendered is less than the total');

    const customerId = await this.walkInCustomerId();

    const order = await this.prisma.$transaction(async (tx) => {
      // Atomic stock guard: decrement only if enough remains, so a concurrent
      // online order grabbing the last unit can't let the counter oversell.
      for (const l of lines) {
        const dec = await tx.merchantProduct.updateMany({
          where: { id: l.offer.id, stockQuantity: { gte: l.qty } },
          data: { stockQuantity: { decrement: l.qty } },
        });
        if (dec.count === 0) {
          throw new BadRequestException(`Stock changed for ${l.offer.product.name} — please re-check`);
        }
      }
      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          channel: 'POS',
          customerId,
          merchantId: ctx.merchantId,
          status: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.CASH_COLLECTED,
          paymentMethod: 'CASH',
          subtotalPaisa,
          totalAmountPaisa: subtotalPaisa,
          commissionAmountPaisa: 0,
          merchantEarningPaisa: subtotalPaisa,
          deliveredAt: new Date(),
          merchantNote: dto.note ?? null,
          items: {
            create: lines.map((l) => ({
              productId: l.offer.productId,
              merchantProductId: l.offer.id,
              productNameSnapshot: l.offer.product.name,
              productImageSnapshot: l.offer.product.imageUrl,
              unitSnapshot: l.offer.product.unit,
              quantity: l.qty,
              unitPricePaisa: l.unitPricePaisa,
              totalPricePaisa: l.totalPricePaisa,
            })),
          },
        },
        include: { items: true },
      });
    });

    return { ...order, amountTenderedPaisa: tendered, changePaisa: tendered - subtotalPaisa };
  }

  async listSales(userId: string, query: { from?: string; to?: string }) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);

    const where: any = { merchantId: ctx.merchantId, channel: 'POS' };
    const range = this.range(query);
    if (range) where.createdAt = range;

    const sales = await this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      count: sales.length,
      totalPaisa: sales.reduce((s, o) => s + o.totalAmountPaisa, 0),
      sales,
    };
  }

  async saleDetail(userId: string, id: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);
    const sale = await this.prisma.order.findFirst({
      where: { id, merchantId: ctx.merchantId, channel: 'POS' },
      include: {
        items: true,
        merchant: { select: { shopName: true, address: true, phoneNumber: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async summary(userId: string, query: { from?: string; to?: string }) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);
    const where: any = { merchantId: ctx.merchantId, channel: 'POS' };
    const range = this.range(query);
    if (range) where.createdAt = range;
    const agg = await this.prisma.order.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalAmountPaisa: true },
    });
    return { count: agg._count._all, totalPaisa: agg._sum.totalAmountPaisa ?? 0 };
  }

  private range(q: { from?: string; to?: string }) {
    const gte = q.from ? new Date(q.from) : undefined;
    const lte = q.to ? new Date(q.to) : undefined;
    if (gte && isNaN(gte.getTime())) throw new BadRequestException('Invalid "from" date');
    if (lte && isNaN(lte.getTime())) throw new BadRequestException('Invalid "to" date');
    if (!gte && !lte) return undefined;
    return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  /**
   * One shared "Walk-in" customer for every POS order. Sales scope by merchantId,
   * so a single walk-in identity satisfies Order.customerId (non-null) without
   * inventing a throwaway customer per sale.
   */
  private async walkInCustomerId(): Promise<string> {
    const existing = await this.prisma.customer.findFirst({
      where: { user: { phoneNumber: WALKIN_PHONE } },
      select: { id: true },
    });
    if (existing) return existing.id;
    const user = await this.prisma.user.upsert({
      where: { phoneNumber: WALKIN_PHONE },
      update: {},
      create: { phoneNumber: WALKIN_PHONE, fullName: 'Walk-in customer', role: UserRole.CUSTOMER },
    });
    const customer = await this.prisma.customer.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    return customer.id;
  }
}
