import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { ProductApprovalStatus, StaffPermission } from '../common/constants';
import { parsePage, paged, PageQuery } from '../common/utils/pagination';
import { AddMerchantProductDto, BulkUploadDto, UpdateMerchantProductDto } from './merchant.dto';
import { randomBytes } from 'crypto';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Injectable()
export class MerchantProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(
    userId: string,
    query: PageQuery & { q?: string; categoryId?: string; lowStock?: string },
  ) {
    const ctx = await this.access.merchantContext(userId);
    const { page, pageSize, skip, take } = parsePage(query);

    const where: any = { merchantId: ctx.merchantId };
    if (query.q) where.product = { name: { contains: query.q, mode: 'insensitive' } };
    if (query.categoryId) {
      where.product = { ...(where.product ?? {}), categoryId: query.categoryId };
    }

    let [rows, total] = await Promise.all([
      this.prisma.merchantProduct.findMany({
        where,
        include: { product: { include: { category: { select: { id: true, name: true } } } } },
        orderBy: { updatedAt: 'desc' },
        ...(query.lowStock === 'true' ? {} : { skip, take }),
      }),
      this.prisma.merchantProduct.count({ where }),
    ]);

    if (query.lowStock === 'true') {
      rows = rows.filter((r) => r.stockQuantity <= r.lowStockThreshold);
      total = rows.length;
      rows = rows.slice(skip, skip + take);
    }
    return paged(rows, total, page, pageSize);
  }

  /**
   * Browse the shared global catalog (APPROVED products) so a merchant can build
   * their store without uploading images. Flags which products the merchant has
   * already listed so the app can show "Added" vs an add button.
   */
  async browseCatalog(
    userId: string,
    query: PageQuery & { q?: string; categoryId?: string; unlistedOnly?: string },
  ) {
    const ctx = await this.access.merchantContext(userId);
    const { page, pageSize, skip, take } = parsePage(query);

    const where: any = { approvalStatus: ProductApprovalStatus.APPROVED };
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;

    // Products this merchant already lists (to flag / optionally exclude).
    const listed = await this.prisma.merchantProduct.findMany({
      where: { merchantId: ctx.merchantId },
      select: { productId: true },
    });
    const listedSet = new Set(listed.map((l) => l.productId));
    if (query.unlistedOnly === 'true' && listedSet.size > 0) {
      where.id = { notIn: [...listedSet] };
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = rows.map((p) => ({
      productId: p.id,
      name: p.name,
      brand: p.brand,
      imageUrl: p.imageUrl,
      unit: p.unit,
      size: p.size,
      category: p.category,
      alreadyListed: listedSet.has(p.id),
    }));
    return paged(items, total, page, pageSize);
  }

  async add(userId: string, dto: AddMerchantProductDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);

    let productId = dto.productId;
    if (!productId && !dto.newProduct) {
      throw new BadRequestException('Provide productId (catalog product) or newProduct');
    }

    if (dto.newProduct) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.newProduct.categoryId },
      });
      if (!category) throw new BadRequestException('Category not found');
      let slug = slugify(dto.newProduct.name);
      if (await this.prisma.product.findUnique({ where: { slug } })) {
        slug = `${slug}-${randomBytes(2).toString('hex')}`;
      }
      // Merchant-created products await admin approval before customers see them.
      const product = await this.prisma.product.create({
        data: {
          name: dto.newProduct.name,
          slug,
          brand: dto.newProduct.brand ?? null,
          description: dto.newProduct.description ?? null,
          categoryId: dto.newProduct.categoryId,
          imageUrl: dto.newProduct.imageUrl ?? null,
          unit: dto.newProduct.unit,
          size: dto.newProduct.size ?? null,
          approvalStatus: ProductApprovalStatus.PENDING,
          createdByMerchantId: ctx.merchantId,
        },
      });
      productId = product.id;
    } else {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException('Catalog product not found');
      if (product.approvalStatus === ProductApprovalStatus.DISABLED) {
        throw new BadRequestException('This product has been disabled by the platform');
      }
    }

    const existing = await this.prisma.merchantProduct.findUnique({
      where: { merchantId_productId: { merchantId: ctx.merchantId, productId: productId! } },
    });
    if (existing) throw new BadRequestException('This product is already listed in your shop');

    if (dto.discountPricePaisa != null && dto.discountPricePaisa >= dto.pricePaisa) {
      throw new BadRequestException('Discount price must be below the regular price');
    }

    return this.prisma.merchantProduct.create({
      data: {
        merchantId: ctx.merchantId,
        productId: productId!,
        pricePaisa: dto.pricePaisa,
        discountPricePaisa: dto.discountPricePaisa ?? null,
        stockQuantity: dto.stockQuantity,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        merchantSku: dto.merchantSku ?? null,
      },
      include: { product: true },
    });
  }

  async update(userId: string, merchantProductId: string, dto: UpdateMerchantProductDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);

    const existing = await this.prisma.merchantProduct.findFirst({
      where: { id: merchantProductId, merchantId: ctx.merchantId },
    });
    if (!existing) throw new NotFoundException('Product not found in your shop');

    const newPrice = dto.pricePaisa ?? existing.pricePaisa;
    if (dto.discountPricePaisa != null && dto.discountPricePaisa !== 0 && dto.discountPricePaisa >= newPrice) {
      throw new BadRequestException('Discount price must be below the regular price');
    }

    return this.prisma.merchantProduct.update({
      where: { id: merchantProductId },
      data: {
        pricePaisa: dto.pricePaisa ?? undefined,
        // discountPricePaisa: 0 clears the discount.
        discountPricePaisa:
          dto.discountPricePaisa === undefined
            ? undefined
            : dto.discountPricePaisa === 0
              ? null
              : dto.discountPricePaisa,
        stockQuantity: dto.stockQuantity ?? undefined,
        isAvailable: dto.isAvailable ?? undefined,
        lowStockThreshold: dto.lowStockThreshold ?? undefined,
        merchantSku: dto.merchantSku ?? undefined,
      },
      include: { product: true },
    });
  }

  /** "Delete" pauses the listing — order history still references it. */
  async remove(userId: string, merchantProductId: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);
    const result = await this.prisma.merchantProduct.updateMany({
      where: { id: merchantProductId, merchantId: ctx.merchantId },
      data: { isAvailable: false },
    });
    if (result.count === 0) throw new NotFoundException('Product not found in your shop');
    return { ok: true };
  }

  async bulkUpload(userId: string, dto: BulkUploadDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);

    let created = 0;
    let updated = 0;
    const failed: Array<{ index: number; error: string }> = [];

    for (const [index, item] of dto.items.entries()) {
      try {
        if (!item.pricePaisa || item.pricePaisa < 1) throw new Error('pricePaisa required');
        if (item.stockQuantity == null || item.stockQuantity < 0) {
          throw new Error('stockQuantity required');
        }

        let productId = item.productId;
        if (!productId) {
          if (!item.name) throw new Error('productId or name required');
          // Match an existing approved catalog product by exact name first.
          const match = await this.prisma.product.findFirst({
            where: { name: item.name, approvalStatus: ProductApprovalStatus.APPROVED },
          });
          if (match) {
            productId = match.id;
          } else {
            if (!item.categoryId) throw new Error(`unknown product "${item.name}" needs categoryId`);
            let slug = slugify(item.name);
            if (await this.prisma.product.findUnique({ where: { slug } })) {
              slug = `${slug}-${randomBytes(2).toString('hex')}`;
            }
            const product = await this.prisma.product.create({
              data: {
                name: item.name,
                slug,
                categoryId: item.categoryId,
                unit: item.unit ?? 'piece',
                approvalStatus: ProductApprovalStatus.PENDING,
                createdByMerchantId: ctx.merchantId,
              },
            });
            productId = product.id;
          }
        }

        const existing = await this.prisma.merchantProduct.findUnique({
          where: { merchantId_productId: { merchantId: ctx.merchantId, productId } },
        });
        if (existing) {
          await this.prisma.merchantProduct.update({
            where: { id: existing.id },
            data: { pricePaisa: item.pricePaisa, stockQuantity: item.stockQuantity, isAvailable: true },
          });
          updated++;
        } else {
          await this.prisma.merchantProduct.create({
            data: {
              merchantId: ctx.merchantId,
              productId,
              pricePaisa: item.pricePaisa,
              stockQuantity: item.stockQuantity,
            },
          });
          created++;
        }
      } catch (err: any) {
        failed.push({ index, error: err.message ?? 'unknown error' });
      }
    }
    return { created, updated, failed };
  }
}
