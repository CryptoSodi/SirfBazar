import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { ProductApprovalStatus, StaffPermission } from '../common/constants';
import { parsePage, paged, PageQuery } from '../common/utils/pagination';
import { AddMerchantProductDto, BulkItemDto, BulkUploadDto, UpdateMerchantProductDto } from './merchant.dto';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { serializable } from '../common/transaction';

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
    query: PageQuery & { q?: string; categoryId?: string; lowStock?: string; isAvailable?: string; minStock?: string },
  ) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);
    const { page, pageSize, skip, take } = parsePage(query);

    const where: any = { merchantId: ctx.merchantId };
    if (query.isAvailable === 'true' || query.isAvailable === 'false') where.isAvailable = query.isAvailable === 'true';
    if (query.minStock !== undefined) {
      const minStock = Number(query.minStock);
      if (!Number.isInteger(minStock) || minStock < 0) throw new BadRequestException('minStock must be a non-negative integer');
      where.stockQuantity = { gte: minStock };
    }
    if (query.q) where.product = { name: { contains: query.q, mode: 'insensitive' } };
    if (query.categoryId) {
      where.product = { ...(where.product ?? {}), categoryId: query.categoryId };
    }

    let [rows, total] = await Promise.all([
      this.prisma.merchantProduct.findMany({
        where,
        include: { product: { include: { category: { select: { id: true, name: true } } } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);
    const { page, pageSize, skip, take } = parsePage(query);

    const where: any = { approvalStatus: ProductApprovalStatus.APPROVED };
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.categoryId) {
      const categories = await this.prisma.category.findMany({ select: { id: true, parentCategoryId: true, isActive: true } });
      const selected = categories.find((category) => category.id === query.categoryId && category.isActive);
      if (!selected) throw new BadRequestException('Category not found');
      const descendants = new Set<string>([selected.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const category of categories) {
          if (category.isActive && category.parentCategoryId && descendants.has(category.parentCategoryId) && !descendants.has(category.id)) {
            descendants.add(category.id);
            changed = true;
          }
        }
      }
      where.categoryId = { in: [...descendants] };
    }

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

  private bulkHash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private bulkKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required for bulk preview');
    return createHmac('sha256', secret || 'dev-secret-do-not-use-in-production').update('sirfbazar-bulk-preview-v1').digest();
  }

  private bulkRequest(dto: BulkUploadDto) {
    return { requestId: dto.requestId, mode: dto.mode ?? 'ADD_MISSING', items: dto.items.map(({ expected: _expected, ...item }) => item) };
  }

  private validateBulk(dto: BulkUploadDto) {
    if (!dto.items?.length || dto.items.length > 1000) throw new BadRequestException('Import must contain 1–1000 rows');
    const ids = new Set<string>();
    for (const item of dto.items) {
      if (!item.rowId || ids.has(item.rowId)) throw new BadRequestException('Each import row needs a unique rowId');
      ids.add(item.rowId);
      if (!Number.isSafeInteger(item.pricePaisa) || item.pricePaisa < 1 || item.pricePaisa > 2_147_483_647 || !Number.isSafeInteger(item.stockQuantity) || item.stockQuantity < 0 || item.stockQuantity > 2_147_483_647) {
        throw new BadRequestException(`Invalid price or whole-unit stock on row ${item.rowId}`);
      }
    }
  }

  private async previewRows(merchantId: string, dto: BulkUploadDto) {
    const seen = new Set<string>();
    const rows: Array<{ rowId: string; status: 'NEW' | 'MATCH' | 'SKIP' | 'CONFLICT'; productId?: string; merchantProductId?: string; old?: { pricePaisa: number; discountPricePaisa: number | null; effectiveSalePricePaisa: number; stockQuantity: number; updatedAt: string }; new: { pricePaisa: number; stockQuantity: number }; error?: string }> = [];
    for (const item of dto.items) {
      const next = { pricePaisa: item.pricePaisa, stockQuantity: item.stockQuantity };
      let product = item.productId ? await this.prisma.product.findUnique({ where: { id: item.productId } }) : null;
      let error: string | undefined;
      if (!product && item.productId) error = 'Catalogue product not found';
      if (!product && !item.productId && item.merchantSku) {
        const barcodeMatches = await this.prisma.product.findMany({ where: { barcode: item.merchantSku, approvalStatus: ProductApprovalStatus.APPROVED }, take: 2 });
        if (barcodeMatches.length === 1) product = barcodeMatches[0];
        else if (barcodeMatches.length > 1) error = 'Barcode matches more than one catalogue product';
      }
      if (!product && !error) {
        if (!item.name?.trim() || !item.categoryId || !item.unit?.trim()) error = 'New products need name, category and unit';
        else {
          const [category, names] = await Promise.all([
            this.prisma.category.findUnique({ where: { id: item.categoryId } }),
            this.prisma.product.findMany({ where: { name: { equals: item.name.trim(), mode: 'insensitive' } }, take: 2 }),
          ]);
          if (!category?.isActive || category.isRestricted) error = 'Choose an active unrestricted category';
          else if (names.length) error = 'Name matches catalogue products; select an exact product or barcode';
        }
      }
      if (product && product.approvalStatus !== ProductApprovalStatus.APPROVED) error = 'Catalogue product is not approved';
      const identity = product ? `product:${product.id}` : `new:${item.name?.trim().toLocaleLowerCase()}:${item.categoryId}`;
      if (seen.has(identity)) error = 'Duplicate product in this import';
      seen.add(identity);
      if (error) {
        rows.push({ rowId: item.rowId, status: 'CONFLICT', productId: product?.id, new: next, error });
        continue;
      }
      const existing = product ? await this.prisma.merchantProduct.findUnique({ where: { merchantId_productId: { merchantId, productId: product.id } } }) : null;
      const old = existing ? { pricePaisa: existing.pricePaisa, discountPricePaisa: existing.discountPricePaisa, effectiveSalePricePaisa: existing.discountPricePaisa ?? existing.pricePaisa, stockQuantity: existing.stockQuantity, updatedAt: existing.updatedAt.toISOString() } : undefined;
      rows.push({ rowId: item.rowId, status: existing ? (dto.mode === 'UPDATE_EXISTING' ? 'MATCH' : 'SKIP') : product ? 'MATCH' : 'NEW', productId: product?.id, merchantProductId: existing?.id, old, new: next });
    }
    return rows;
  }

  async bulkPreview(userId: string, dto: BulkUploadDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);
    this.validateBulk(dto);
    const rows = await this.previewRows(ctx.merchantId, dto);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const payload = Buffer.from(JSON.stringify({ merchantId: ctx.merchantId, requestHash: this.bulkHash(this.bulkRequest(dto)), expiresAt, rows })).toString('base64url');
    const signature = createHmac('sha256', this.bulkKey()).update(payload).digest('base64url');
    return { rows, previewToken: `${payload}.${signature}`, expiresAt };
  }

  private verifiedPreview(merchantId: string, dto: BulkUploadDto) {
    if (!dto.previewToken) return null;
    try {
      const [payload, signature, extra] = dto.previewToken.split('.');
      if (!payload || !signature || extra) throw new Error('format');
      const actual = Buffer.from(signature, 'base64url');
      const expected = createHmac('sha256', this.bulkKey()).update(payload).digest();
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('signature');
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (parsed.merchantId !== merchantId || parsed.requestHash !== this.bulkHash(this.bulkRequest(dto)) || !Number.isFinite(Date.parse(parsed.expiresAt)) || !Array.isArray(parsed.rows)) throw new Error('request');
      return { rows: parsed.rows as Awaited<ReturnType<MerchantProductsService['previewRows']>>, expired: Date.parse(parsed.expiresAt) <= Date.now() };
    } catch {
      throw new ConflictException('Import preview expired or changed. Preview these rows again.');
    }
  }

  async bulkUpload(userId: string, dto: BulkUploadDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.INVENTORY);
    this.validateBulk(dto);
    const mode = dto.mode ?? 'ADD_MISSING';
    const verified = this.verifiedPreview(ctx.merchantId, dto);
    const preview = verified?.rows;
    if (verified?.expired) {
      // A lost success response may be retried after expiry, but expiry can
      // never authorize a fresh row write (including a formerly skipped row).
      const replayed = [] as Array<{ rowId: string; status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED'; merchantProductId?: string; error?: string }>;
      const failed: Array<{ index: number; error: string }> = [];
      for (const [index, item] of dto.items.entries()) {
        const fingerprint = this.bulkHash({ merchantId: ctx.merchantId, requestId: dto.requestId, mode, item });
        const auditId = `bulk:${this.bulkHash(`${ctx.merchantId}:${dto.requestId}:${item.rowId}`).slice(0, 48)}`;
        const audit = await this.prisma.auditLog.findUnique({ where: { id: auditId } });
        const saved = audit ? JSON.parse(audit.newValue ?? '{}') : null;
        if (saved && (saved.fingerprint !== fingerprint || !saved.result)) throw new ConflictException('Import row reference cannot be reused with changed values');
        if (saved) replayed.push(saved.result);
        else {
          const error = 'Import preview expired before this row was applied. Preview this row again.';
          replayed.push({ rowId: item.rowId, status: 'FAILED', error });
          failed.push({ index, error });
        }
      }
      return { created: replayed.filter((row) => row.status === 'CREATED').length, updated: replayed.filter((row) => row.status === 'UPDATED').length, skipped: replayed.filter((row) => row.status === 'SKIPPED').length, failed, rows: replayed };
    }
    if (!preview && (mode !== 'ADD_MISSING' || dto.items.some((item) => !item.productId))) {
      throw new ConflictException('Preview and confirm this import before applying changes.');
    }
    const rows: Array<{ rowId: string; status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED'; merchantProductId?: string; error?: string }> = [];
    const failed: Array<{ index: number; error: string }> = [];
    for (const [index, item] of dto.items.entries()) {
      const snapshot = preview?.find((row) => row.rowId === item.rowId);
      const fingerprint = this.bulkHash({ merchantId: ctx.merchantId, requestId: dto.requestId, mode, item });
      const auditId = `bulk:${this.bulkHash(`${ctx.merchantId}:${dto.requestId}:${item.rowId}`).slice(0, 48)}`;
      try {
        const result = await serializable(this.prisma, async (tx) => {
          const existingAudit = await tx.auditLog.findUnique({ where: { id: auditId } });
          if (existingAudit) {
            const saved = JSON.parse(existingAudit.newValue ?? '{}');
            if (saved.fingerprint !== fingerprint) throw new ConflictException('Import row reference cannot be reused with changed values');
            return saved.result as (typeof rows)[number];
          }
          if (snapshot?.status === 'CONFLICT') throw new ConflictException(snapshot.error ?? 'Import row conflicts with catalogue');
          if (snapshot?.status === 'SKIP') {
            const result = { rowId: item.rowId, status: 'SKIPPED' as const, merchantProductId: snapshot.merchantProductId };
            await tx.auditLog.create({ data: { id: auditId, userId, role: ctx.isOwner ? 'MERCHANT_OWNER' : 'MERCHANT_STAFF', action: 'BULK_PRODUCT_ROW', entityType: 'MerchantProduct', entityId: result.merchantProductId ?? null, newValue: JSON.stringify({ fingerprint, result }) } });
            return result;
          }
          let productId = snapshot?.productId ?? item.productId;
          if (!productId) {
            if (!snapshot || snapshot.status !== 'NEW' || !item.name || !item.categoryId || !item.unit) throw new ConflictException('Preview new products before import');
            const category = await tx.category.findUnique({ where: { id: item.categoryId } });
            if (!category?.isActive || category.isRestricted) throw new ConflictException('Category changed. Preview again.');
            const product = await tx.product.create({ data: {
              name: item.name.trim(), slug: `${slugify(item.name)}-${randomBytes(4).toString('hex')}`,
              categoryId: item.categoryId, unit: item.unit,
              approvalStatus: ProductApprovalStatus.PENDING, createdByMerchantId: ctx.merchantId,
            } });
            productId = product.id;
          }
          let result: (typeof rows)[number];
          if (snapshot?.status === 'MATCH' && snapshot.old && mode === 'UPDATE_EXISTING') {
            if (!snapshot.merchantProductId || !snapshot.old) throw new ConflictException('Update preview is incomplete');
            const changed = await tx.merchantProduct.updateMany({
              where: { id: snapshot.merchantProductId, merchantId: ctx.merchantId, productId, pricePaisa: snapshot.old.pricePaisa, discountPricePaisa: snapshot.old.discountPricePaisa, stockQuantity: snapshot.old.stockQuantity, updatedAt: new Date(snapshot.old.updatedAt) },
              data: { pricePaisa: item.pricePaisa, discountPricePaisa: null, stockQuantity: item.stockQuantity },
            });
            if (changed.count !== 1) throw new ConflictException('Price or stock changed. Preview this row again.');
            result = { rowId: item.rowId, status: 'UPDATED', merchantProductId: snapshot.merchantProductId };
          } else {
            const product = await tx.product.findUnique({ where: { id: productId }, include: { category: true } });
            if (!product || product.approvalStatus === ProductApprovalStatus.DISABLED || product.approvalStatus === ProductApprovalStatus.REJECTED || product.isRestricted || product.requiresPrescription || product.category.isRestricted) {
              throw new ConflictException('Catalogue product is unavailable. Preview again.');
            }
            const current = await tx.merchantProduct.findUnique({ where: { merchantId_productId: { merchantId: ctx.merchantId, productId } } });
            if (current) result = { rowId: item.rowId, status: 'SKIPPED', merchantProductId: current.id };
            else {
              const created = await tx.merchantProduct.create({ data: { merchantId: ctx.merchantId, productId, pricePaisa: item.pricePaisa, stockQuantity: item.stockQuantity, merchantSku: item.merchantSku ?? null } });
              result = { rowId: item.rowId, status: 'CREATED', merchantProductId: created.id };
            }
          }
          await tx.auditLog.create({ data: { id: auditId, userId, role: ctx.isOwner ? 'MERCHANT_OWNER' : 'MERCHANT_STAFF', action: 'BULK_PRODUCT_ROW', entityType: 'MerchantProduct', entityId: result.merchantProductId ?? null, newValue: JSON.stringify({ fingerprint, result }) } });
          return result;
        });
        rows.push(result);
      } catch (error: any) {
        const saved = await this.prisma.auditLog.findUnique({ where: { id: auditId } });
        if (saved) {
          const record = JSON.parse(saved.newValue ?? '{}');
          if (record.fingerprint === fingerprint && record.result) { rows.push(record.result); continue; }
        }
        const message = error instanceof ConflictException ? String((error.getResponse() as any).message ?? error.message) : (error?.message ?? 'Unable to import row');
        rows.push({ rowId: item.rowId, status: 'FAILED', error: message });
        failed.push({ index, error: message });
      }
    }
    return { created: rows.filter((row) => row.status === 'CREATED').length, updated: rows.filter((row) => row.status === 'UPDATED').length, skipped: rows.filter((row) => row.status === 'SKIPPED').length, failed, rows };
  }
}
