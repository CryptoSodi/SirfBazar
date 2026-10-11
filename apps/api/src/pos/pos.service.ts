import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { OrderStatus, PaymentStatus, ProductApprovalStatus, StaffPermission, UserRole } from '../common/constants';
import { generateOrderNumber } from '../common/utils/ids';
import { merchantPosTrialView } from '../common/merchant-access-policy';

interface SaleItemInput {
  merchantProductId: string;
  quantity: number;
  expectedUnitPricePaisa?: number;
}
interface CreateSaleInput {
  requestId?: string;
  counterName?: string;
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

  async capabilities(userId: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);
    const posTrial = await this.posTrial(ctx.merchantId);
    return {
      version: 3,
      merchantId: ctx.merchantId,
      idempotentSales: true,
      barcodeLookup: true,
      paymentMethods: ['CASH'],
      offlineSales: false,
      trial: posTrial,
      salesEnabled: posTrial.salesEnabled,
      readOnly: !posTrial.salesEnabled,
    };
  }

  private async posTrial(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { userId: true } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const trial = await this.prisma.merchantPosTrial.findUnique({ where: { userId: merchant.userId } });
    return merchantPosTrialView(trial);
  }

  private async requireSalesEnabled(merchantId: string) {
    const trial = await this.posTrial(merchantId);
    if (!trial.salesEnabled) {
      throw new ForbiddenException(trial.status === 'EXPIRED'
        ? 'The POS trial has ended. Sales are disabled; existing POS records remain read-only.'
        : 'POS sales are disabled for this shop.');
    }
  }

  private productView(row: any) {
    return {
      merchantProductId: row.id, productId: row.productId, name: row.product.name,
      imageUrl: row.product.imageUrl, unit: row.product.unit, barcode: row.product.barcode,
      merchantSku: row.merchantSku, pricePaisa: row.discountPricePaisa ?? row.pricePaisa,
      stockQuantity: row.stockQuantity,
      isAvailable: row.isAvailable && row.product.approvalStatus === ProductApprovalStatus.APPROVED &&
        !row.product.isRestricted && !row.product.requiresPrescription,
    };
  }

  async lookupProduct(userId: string, rawCode: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!code || code.length > 128 || /[\x00-\x1f\x7f]/.test(code)) throw new BadRequestException('Scan or enter a valid barcode or shop SKU.');
    const rows = await this.prisma.merchantProduct.findMany({
      where: { merchantId: ctx.merchantId, OR: [{ merchantSku: code }, { product: { barcode: code } }] },
      include: { product: true }, take: 2,
    });
    if (!rows.length) throw new NotFoundException('No item matches this code in your shop. Search by name or check its barcode/SKU.');
    if (rows.length > 1) throw new ConflictException('This code matches more than one item. Correct the duplicate barcode/SKU before scanning.');
    return this.productView(rows[0]);
  }

  /** Products in the merchant's own store, for the register grid. */
  async listProducts(userId: string, q?: string, ids?: string[]) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);

    const where: any = { merchantId: ctx.merchantId };
    if (ids) where.id = { in: ids };
    if (q?.trim()) where.OR = [{ product: { name: { contains: q.trim(), mode: 'insensitive' } } }, { product: { barcode: q.trim() } }, { merchantSku: q.trim() }];

    const rows = await this.prisma.merchantProduct.findMany({
      where,
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
      take: 300,
    });
    return rows.map((r) => this.productView(r));
  }

  /** Ring up a cash sale: decrement unified stock + record a channel=POS order. */
  async createSale(userId: string, dto: CreateSaleInput) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.POS);
    if (!dto.items?.length || dto.items.length > 200) throw new BadRequestException('Add between 1 and 200 distinct items to the sale.');

    const fingerprint = createHash('sha256').update(JSON.stringify({
      items: [...dto.items].sort((a, b) => a.merchantProductId.localeCompare(b.merchantProductId))
        .map((item) => ({ merchantProductId: item.merchantProductId, quantity: item.quantity, expectedUnitPricePaisa: item.expectedUnitPricePaisa ?? null })),
      amountTenderedPaisa: dto.amountTenderedPaisa ?? null, note: dto.note ?? null, counterName: dto.counterName ?? null,
    })).digest('hex');
    const replay = async () => {
      if (!dto.requestId) return null;
      const saved = await this.prisma.order.findUnique({ where: { id: dto.requestId }, include: { items: true } });
      if (!saved) return null;
      if (saved.merchantId !== ctx.merchantId || saved.channel !== 'POS') throw new ConflictException('Sale reference is already in use. Contact support; do not charge again.');
      const meta = await this.saleMetadata(saved.id);
      if (!meta || meta.requestHash !== fingerprint || meta.cashierId !== userId) throw new ConflictException('Sale reference does not match this request. Check the original receipt; do not charge again.');
      return { ...saved, ...this.receiptMetadata(meta) };
    };
    const saved = await replay();
    if (saved) return saved;
    await this.requireSalesEnabled(ctx.merchantId);

    try {
    const ids = dto.items.map((i) => i.merchantProductId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Combine repeated items into a single line.');
    const offers = await this.prisma.merchantProduct.findMany({
      where: { id: { in: ids }, merchantId: ctx.merchantId },
      include: { product: true },
    });
    const byId = new Map(offers.map((o) => [o.id, o]));

    const lines = dto.items.map((i) => {
      const offer = byId.get(i.merchantProductId);
      if (!offer) throw new BadRequestException('One of the products is no longer in your store. Remove it before payment.');
      const qty = i.quantity;
      if (!Number.isSafeInteger(qty) || qty <= 0 || qty > 100000) {
        throw new BadRequestException(`Invalid quantity for ${offer.product.name}`);
      }
      if (!this.productView(offer).isAvailable) throw new BadRequestException(`${offer.product.name} is unavailable for counter sales. Remove it or check its approval and availability.`);
      if (offer.stockQuantity < qty) {
        throw new BadRequestException(`Only ${offer.stockQuantity} of ${offer.product.name} left in stock`);
      }
      const unitPricePaisa = offer.discountPricePaisa ?? offer.pricePaisa;
      if (i.expectedUnitPricePaisa !== undefined && i.expectedUnitPricePaisa !== unitPricePaisa) throw new BadRequestException(`Price changed for ${offer.product.name}. Refresh the bill and review the new total before payment.`);
      if (!Number.isSafeInteger(unitPricePaisa) || unitPricePaisa < 0) throw new BadRequestException('An item has an invalid price. Correct it before selling.');
      return { offer, qty, unitPricePaisa, totalPricePaisa: unitPricePaisa * qty };
    });

    const subtotalPaisa = lines.reduce((s, l) => s + l.totalPricePaisa, 0);
    const tendered = dto.amountTenderedPaisa ?? subtotalPaisa;
    if (!Number.isSafeInteger(subtotalPaisa) || subtotalPaisa > 2147483647 || !Number.isSafeInteger(tendered) || tendered > 2147483647) throw new BadRequestException('Bill or cash amount exceeds the supported limit.');
    if (tendered < subtotalPaisa) throw new BadRequestException('Cash tendered is less than the total');

    const customerId = await this.walkInCustomerId();

    const meta = { version: 1, requestHash: fingerprint, cashierId: userId, counterName: dto.counterName ?? null, amountTenderedPaisa: tendered, changePaisa: tendered - subtotalPaisa };
    const order = await this.prisma.$transaction(async (tx) => {
      // Atomic stock guard: decrement only if enough remains, so a concurrent
      // online order grabbing the last unit can't let the counter oversell.
      for (const l of lines) {
        const dec = await tx.merchantProduct.updateMany({
          where: { id: l.offer.id, merchantId: ctx.merchantId, isAvailable: true, stockQuantity: { gte: l.qty },
            pricePaisa: l.offer.pricePaisa, discountPricePaisa: l.offer.discountPricePaisa,
            product: { approvalStatus: ProductApprovalStatus.APPROVED, isRestricted: false, requiresPrescription: false } },
          data: { stockQuantity: { decrement: l.qty } },
        });
        if (dec.count === 0) {
          throw new BadRequestException(`Stock changed for ${l.offer.product.name} — please re-check`);
        }
      }
      const created = await tx.order.create({
        data: {
          ...(dto.requestId ? { id: dto.requestId } : {}),
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
      await tx.auditLog.create({ data: {
        userId, role: ctx.isOwner ? UserRole.MERCHANT_OWNER : UserRole.MERCHANT_STAFF,
        action: 'POS_SALE_COMPLETED', entityType: 'PosSale', entityId: created.id, newValue: JSON.stringify(meta),
      } });
      return created;
    });

    return { ...order, ...this.receiptMetadata(meta) };
    } catch (error) {
      // A concurrent identical request may commit between the initial replay
      // check and catalogue validation, or while waiting for stock locks. Recover
      // that receipt even when this attempt observes depleted stock/stale prices.
      const recovered = await replay();
      if (recovered) return recovered;
      throw error;
    }
  }

  private async saleMetadata(id: string) {
    const audit = await this.prisma.auditLog.findFirst({ where: { entityType: 'PosSale', entityId: id, action: 'POS_SALE_COMPLETED' }, orderBy: { createdAt: 'asc' } });
    if (!audit?.newValue) return null;
    try { return JSON.parse(audit.newValue); } catch { return null; }
  }

  private receiptMetadata(meta: any) {
    return { amountTenderedPaisa: meta?.amountTenderedPaisa ?? null, changePaisa: meta?.changePaisa ?? null,
      counterName: meta?.counterName ?? null, cashierId: meta?.cashierId ?? null };
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
    return { ...sale, ...this.receiptMetadata(await this.saleMetadata(sale.id)) };
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
