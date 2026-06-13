import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantApprovalStatus, ProductApprovalStatus } from '../common/constants';
import { boundingBox, estimateDeliveryMinutes, haversineKm } from '../common/utils/geo';
import { paged, parsePage } from '../common/utils/pagination';
import {
  LocationQuery,
  NearbyMerchantsQuery,
  NearbyProductsQuery,
  ProductSort,
  SearchProductsQuery,
} from './catalog.dto';

const DEFAULT_RADIUS_KM = 10;
const CARD_LIST_LIMIT = 20;

export interface ProductCard {
  productId: string;
  merchantProductId: string;
  name: string;
  slug: string;
  brand: string | null;
  imageUrl: string | null;
  unit: string;
  size: string | null;
  categoryId: string;
  pricePaisa: number;
  discountPricePaisa: number | null;
  merchant: {
    id: string;
    shopName: string;
    ratingAverage: number;
    distanceKm: number | null;
    estimatedDeliveryMinutes: number | null;
  };
  stockQuantity: number;
  isAvailable: boolean;
}

interface MerchantReach {
  distanceKm: number;
  estimatedDeliveryMinutes: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Catalog browse (global, merchant-independent) ────────────────────────────

  /**
   * The full SirfBazar catalog for discovery/browsing — every APPROVED product,
   * regardless of whether a nearby merchant stocks it. Customers browse this in
   * category pages; ordering still flows through merchant shops shown on the
   * product detail page (offers).
   */
  async catalogProducts(query: SearchProductsQuery) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where: Prisma.ProductWhereInput = { approvalStatus: ProductApprovalStatus.APPROVED };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          slug: true,
          brand: true,
          imageUrl: true,
          unit: true,
          size: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = rows.map((p) => ({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      imageUrl: p.imageUrl,
      unit: p.unit,
      size: p.size,
      categoryId: p.categoryId,
      category: p.category,
    }));
    return paged(items, total, page, pageSize);
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async categoriesTree() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        parentCategoryId: true,
        name: true,
        slug: true,
        iconUrl: true,
        sortOrder: true,
      },
    });

    type Node = {
      id: string;
      name: string;
      slug: string;
      iconUrl: string | null;
      sortOrder: number;
      children: Node[];
    };
    const nodes = new Map<string, Node>();
    for (const c of categories) {
      nodes.set(c.id, {
        id: c.id,
        name: c.name,
        slug: c.slug,
        iconUrl: c.iconUrl,
        sortOrder: c.sortOrder,
        children: [],
      });
    }
    const roots: Node[] = [];
    for (const c of categories) {
      const node = nodes.get(c.id)!;
      const parent = c.parentCategoryId ? nodes.get(c.parentCategoryId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  // ── Nearby merchant resolution ──────────────────────────────────────────────

  /**
   * Approved merchants reachable from a point: coarse bounding-box prefilter,
   * then exact haversine. A merchant is in range when the distance is within
   * both the requested radius (default 10 km) and its own serviceRadiusKm.
   */
  async merchantsInRange(
    latitude: number,
    longitude: number,
    radiusKm?: number,
    extraWhere: Prisma.MerchantWhereInput = {},
  ) {
    const radius = radiusKm && radiusKm > 0 ? radiusKm : DEFAULT_RADIUS_KM;
    const box = boundingBox(latitude, longitude, radius);
    const candidates = await this.prisma.merchant.findMany({
      where: {
        approvalStatus: MerchantApprovalStatus.APPROVED,
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLon, lte: box.maxLon },
        ...extraWhere,
      },
    });

    const inRange: { merchant: (typeof candidates)[number]; reach: MerchantReach }[] = [];
    for (const merchant of candidates) {
      const exactKm = haversineKm(latitude, longitude, merchant.latitude, merchant.longitude);
      if (exactKm > Math.min(radius, merchant.serviceRadiusKm)) continue;
      const distanceKm = round1(exactKm);
      inRange.push({
        merchant,
        reach: {
          distanceKm,
          estimatedDeliveryMinutes: estimateDeliveryMinutes(
            distanceKm,
            merchant.averagePreparationMinutes,
          ),
        },
      });
    }
    inRange.sort((a, b) => a.reach.distanceKm - b.reach.distanceKm);
    return inRange;
  }

  // ── ProductCard building ────────────────────────────────────────────────────

  /**
   * Builds one ProductCard per product: the best offer is the nearest merchant,
   * tie-broken by cheapest effective price. Without coordinates distance
   * filtering is skipped and distance fields are null (guest browsing).
   */
  private async buildProductCards(opts: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    productWhere?: Prisma.ProductWhereInput;
    productIds?: string[];
    minPricePaisa?: number;
    maxPricePaisa?: number;
    sort?: ProductSort;
  }): Promise<ProductCard[]> {
    const hasLocation = opts.latitude != null && opts.longitude != null;
    const reachByMerchant = new Map<string, MerchantReach>();

    let merchantFilter: Prisma.MerchantProductWhereInput;
    if (hasLocation) {
      const inRange = await this.merchantsInRange(opts.latitude!, opts.longitude!, opts.radiusKm);
      if (inRange.length === 0) return [];
      for (const { merchant, reach } of inRange) reachByMerchant.set(merchant.id, reach);
      merchantFilter = { merchantId: { in: [...reachByMerchant.keys()] } };
    } else {
      merchantFilter = { merchant: { approvalStatus: MerchantApprovalStatus.APPROVED } };
    }

    const offers = await this.prisma.merchantProduct.findMany({
      where: {
        isAvailable: true,
        stockQuantity: { gt: 0 },
        ...merchantFilter,
        product: {
          approvalStatus: ProductApprovalStatus.APPROVED,
          ...(opts.productIds ? { id: { in: opts.productIds } } : {}),
          ...(opts.productWhere ?? {}),
        },
      },
      include: { product: true, merchant: true },
    });

    const effective = (o: (typeof offers)[number]) => o.discountPricePaisa ?? o.pricePaisa;

    const bestByProduct = new Map<string, (typeof offers)[number]>();
    for (const offer of offers) {
      const price = effective(offer);
      if (opts.minPricePaisa != null && price < opts.minPricePaisa) continue;
      if (opts.maxPricePaisa != null && price > opts.maxPricePaisa) continue;

      const current = bestByProduct.get(offer.productId);
      if (!current) {
        bestByProduct.set(offer.productId, offer);
        continue;
      }
      const dNew = reachByMerchant.get(offer.merchantId)?.distanceKm ?? Number.POSITIVE_INFINITY;
      const dCur = reachByMerchant.get(current.merchantId)?.distanceKm ?? Number.POSITIVE_INFINITY;
      if (dNew < dCur || (dNew === dCur && price < effective(current))) {
        bestByProduct.set(offer.productId, offer);
      }
    }

    const cards: ProductCard[] = [...bestByProduct.values()].map((offer) => {
      const reach = reachByMerchant.get(offer.merchantId);
      return {
        productId: offer.productId,
        merchantProductId: offer.id,
        name: offer.product.name,
        slug: offer.product.slug,
        brand: offer.product.brand,
        imageUrl: offer.product.imageUrl,
        unit: offer.product.unit,
        size: offer.product.size,
        categoryId: offer.product.categoryId,
        pricePaisa: offer.pricePaisa,
        discountPricePaisa: offer.discountPricePaisa,
        merchant: {
          id: offer.merchant.id,
          shopName: offer.merchant.shopName,
          ratingAverage: offer.merchant.ratingAverage,
          distanceKm: reach?.distanceKm ?? null,
          estimatedDeliveryMinutes: reach?.estimatedDeliveryMinutes ?? null,
        },
        stockQuantity: offer.stockQuantity,
        isAvailable: offer.isAvailable,
      };
    });

    this.sortCards(cards, opts.sort ?? 'relevance');
    return cards;
  }

  private sortCards(cards: ProductCard[], sort: ProductSort) {
    const price = (c: ProductCard) => c.discountPricePaisa ?? c.pricePaisa;
    const distance = (c: ProductCard) => c.merchant.distanceKm ?? Number.POSITIVE_INFINITY;
    switch (sort) {
      case 'price_asc':
        cards.sort((a, b) => price(a) - price(b));
        break;
      case 'price_desc':
        cards.sort((a, b) => price(b) - price(a));
        break;
      case 'rating':
        cards.sort((a, b) => b.merchant.ratingAverage - a.merchant.ratingAverage);
        break;
      case 'distance':
        cards.sort((a, b) => distance(a) - distance(b));
        break;
      case 'relevance':
      default:
        // Relevance = nearest first, then best rated.
        cards.sort(
          (a, b) =>
            distance(a) - distance(b) || b.merchant.ratingAverage - a.merchant.ratingAverage,
        );
        break;
    }
  }

  // ── Product discovery ───────────────────────────────────────────────────────

  async search(query: SearchProductsQuery) {
    const { page, pageSize, skip, take } = parsePage(query);

    const productWhere: Prisma.ProductWhereInput = {};
    if (query.categoryId) productWhere.categoryId = query.categoryId;
    if (query.brand) productWhere.brand = { contains: query.brand, mode: 'insensitive' };
    if (query.q?.trim()) {
      const q = query.q.trim();
      productWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const cards = await this.buildProductCards({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      productWhere,
      minPricePaisa: query.minPricePaisa,
      maxPricePaisa: query.maxPricePaisa,
      sort: query.sort,
    });
    return paged(cards.slice(skip, skip + take), cards.length, page, pageSize);
  }

  async nearbyProducts(query: NearbyProductsQuery) {
    const { page, pageSize, skip, take } = parsePage(query);
    const cards = await this.buildProductCards({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      productWhere: query.categoryId ? { categoryId: query.categoryId } : undefined,
    });
    return paged(cards.slice(skip, skip + take), cards.length, page, pageSize);
  }

  /** Top products by OrderItem count over the last 30 days (all-time fallback). */
  async popularProducts(query: LocationQuery): Promise<ProductCard[]> {
    const since = new Date(Date.now() - 30 * 86400_000);
    let top = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { createdAt: { gte: since } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 50,
    });
    if (top.length === 0) {
      // Cast: Prisma's groupBy overload inference trips without a `where`.
      top = (await this.prisma.orderItem.groupBy({
        by: ['productId'],
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 50,
      } as any)) as typeof top;
    }

    if (top.length === 0) {
      // Fresh database with no orders yet — fall back to default-ranked cards.
      const cards = await this.buildProductCards({
        latitude: query.latitude,
        longitude: query.longitude,
      });
      return cards.slice(0, CARD_LIST_LIMIT);
    }

    const rank = new Map(top.map((t, i) => [t.productId, i]));
    const cards = await this.buildProductCards({
      latitude: query.latitude,
      longitude: query.longitude,
      productIds: [...rank.keys()],
    });
    cards.sort((a, b) => (rank.get(a.productId) ?? 0) - (rank.get(b.productId) ?? 0));
    return cards.slice(0, CARD_LIST_LIMIT);
  }

  /** Personalized when a JWT is present: biased toward past order categories. */
  async recommendedProducts(query: LocationQuery, userId?: string): Promise<ProductCard[]> {
    if (userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (customer) {
        const recentItems = await this.prisma.orderItem.findMany({
          where: { order: { customerId: customer.id } },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { productId: true },
        });
        if (recentItems.length > 0) {
          const products = await this.prisma.product.findMany({
            where: { id: { in: [...new Set(recentItems.map((i) => i.productId))] } },
            select: { categoryId: true },
          });
          const counts = new Map<string, number>();
          for (const p of products) {
            counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
          }
          const topCategoryIds = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([categoryId]) => categoryId);
          if (topCategoryIds.length > 0) {
            const cards = await this.buildProductCards({
              latitude: query.latitude,
              longitude: query.longitude,
              productWhere: { categoryId: { in: topCategoryIds } },
            });
            if (cards.length > 0) return cards.slice(0, CARD_LIST_LIMIT);
          }
        }
      }
    }
    return this.popularProducts(query);
  }

  // ── Product detail ──────────────────────────────────────────────────────────

  async productDetail(productId: string, query: LocationQuery) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!product || product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw new NotFoundException('Product not found');
    }

    const hasLocation = query.latitude != null && query.longitude != null;
    const reachByMerchant = new Map<string, MerchantReach>();
    let merchantFilter: Prisma.MerchantProductWhereInput = {
      merchant: { approvalStatus: MerchantApprovalStatus.APPROVED },
    };
    if (hasLocation) {
      const inRange = await this.merchantsInRange(query.latitude!, query.longitude!);
      for (const { merchant, reach } of inRange) reachByMerchant.set(merchant.id, reach);
      merchantFilter = { merchantId: { in: [...reachByMerchant.keys()] } };
    }

    const offerRows = await this.prisma.merchantProduct.findMany({
      where: { productId, ...merchantFilter },
      include: {
        merchant: { select: { id: true, shopName: true, ratingAverage: true } },
      },
    });
    const offers = offerRows
      .map((o) => {
        const reach = reachByMerchant.get(o.merchant.id);
        return {
          merchantProductId: o.id,
          merchant: {
            id: o.merchant.id,
            shopName: o.merchant.shopName,
            ratingAverage: o.merchant.ratingAverage,
            distanceKm: reach?.distanceKm ?? null,
            estimatedDeliveryMinutes: reach?.estimatedDeliveryMinutes ?? null,
          },
          pricePaisa: o.pricePaisa,
          discountPricePaisa: o.discountPricePaisa,
          stockQuantity: o.stockQuantity,
          isAvailable: o.isAvailable,
        };
      })
      .sort(
        (a, b) =>
          (a.merchant.distanceKm ?? Number.POSITIVE_INFINITY) -
            (b.merchant.distanceKm ?? Number.POSITIVE_INFINITY) ||
          (a.discountPricePaisa ?? a.pricePaisa) - (b.discountPricePaisa ?? b.pricePaisa),
      );

    const similar = (
      await this.buildProductCards({
        latitude: query.latitude,
        longitude: query.longitude,
        productWhere: { categoryId: product.categoryId, NOT: { id: product.id } },
      })
    ).slice(0, 8);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      description: product.description,
      categoryId: product.categoryId,
      category: product.category,
      imageUrl: product.imageUrl,
      unit: product.unit,
      size: product.size,
      barcode: product.barcode,
      isRestricted: product.isRestricted,
      requiresPrescription: product.requiresPrescription,
      offers,
      similar,
    };
  }

  // ── Merchant discovery ──────────────────────────────────────────────────────

  async nearbyMerchants(query: NearbyMerchantsQuery) {
    const { page, pageSize, skip, take } = parsePage(query);

    const extraWhere: Prisma.MerchantWhereInput = {};
    if (query.shopType) extraWhere.shopType = query.shopType;
    if (query.categoryId) {
      extraWhere.products = {
        some: {
          isAvailable: true,
          stockQuantity: { gt: 0 },
          product: {
            categoryId: query.categoryId,
            approvalStatus: ProductApprovalStatus.APPROVED,
          },
        },
      };
    }

    let rows: { merchant: any; reach: MerchantReach | null }[];
    if (query.latitude != null && query.longitude != null) {
      const inRange = await this.merchantsInRange(
        query.latitude,
        query.longitude,
        query.radiusKm,
        extraWhere,
      );
      rows = inRange.map(({ merchant, reach }) => ({ merchant, reach }));
    } else {
      // Guest browsing without location: list approved merchants, no distances.
      const merchants = await this.prisma.merchant.findMany({
        where: { approvalStatus: MerchantApprovalStatus.APPROVED, ...extraWhere },
        orderBy: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
      });
      rows = merchants.map((merchant) => ({ merchant, reach: null }));
    }

    const items = rows.map(({ merchant, reach }) => this.merchantCard(merchant, reach));
    return paged(items.slice(skip, skip + take), items.length, page, pageSize);
  }

  async merchantDetail(merchantId: string, query: LocationQuery) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant || merchant.approvalStatus !== MerchantApprovalStatus.APPROVED) {
      throw new NotFoundException('Merchant not found');
    }

    let reach: MerchantReach | null = null;
    if (query.latitude != null && query.longitude != null) {
      const distanceKm = round1(
        haversineKm(query.latitude, query.longitude, merchant.latitude, merchant.longitude),
      );
      reach = {
        distanceKm,
        estimatedDeliveryMinutes: estimateDeliveryMinutes(
          distanceKm,
          merchant.averagePreparationMinutes,
        ),
      };
    }

    return {
      ...this.merchantCard(merchant, reach),
      description: merchant.description,
      openingTime: merchant.openingTime,
      closingTime: merchant.closingTime,
      address: merchant.address,
      phoneNumber: merchant.phoneNumber, // shop's public contact (spec 10.8)
    };
  }

  async merchantProducts(
    merchantId: string,
    query: { categoryId?: string; q?: string; page?: number; pageSize?: number },
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, approvalStatus: true },
    });
    if (!merchant || merchant.approvalStatus !== MerchantApprovalStatus.APPROVED) {
      throw new NotFoundException('Merchant not found');
    }

    const { page, pageSize, skip, take } = parsePage(query);
    const where: Prisma.MerchantProductWhereInput = {
      merchantId,
      product: {
        approvalStatus: ProductApprovalStatus.APPROVED,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                { name: { contains: query.q.trim(), mode: 'insensitive' as const } },
                { brand: { contains: query.q.trim(), mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.merchantProduct.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              unit: true,
              size: true,
              brand: true,
              categoryId: true,
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
        skip,
        take,
      }),
      this.prisma.merchantProduct.count({ where }),
    ]);

    const items = rows.map((row) => ({
      merchantProductId: row.id,
      product: row.product,
      pricePaisa: row.pricePaisa,
      discountPricePaisa: row.discountPricePaisa,
      stockQuantity: row.stockQuantity,
      isAvailable: row.isAvailable,
    }));
    return paged(items, total, page, pageSize);
  }

  private merchantCard(
    merchant: {
      id: string;
      shopName: string;
      shopType: string;
      logoUrl: string | null;
      bannerUrl: string | null;
      ratingAverage: number;
      ratingCount: number;
      minimumOrderValuePaisa: number;
      isOnline: boolean;
      isOpen: boolean;
      city: string;
      area: string | null;
    },
    reach: MerchantReach | null,
  ) {
    return {
      id: merchant.id,
      shopName: merchant.shopName,
      shopType: merchant.shopType,
      logoUrl: merchant.logoUrl,
      bannerUrl: merchant.bannerUrl,
      ratingAverage: merchant.ratingAverage,
      ratingCount: merchant.ratingCount,
      distanceKm: reach?.distanceKm ?? null,
      estimatedDeliveryMinutes: reach?.estimatedDeliveryMinutes ?? null,
      minimumOrderValuePaisa: merchant.minimumOrderValuePaisa,
      isOnline: merchant.isOnline,
      isOpen: merchant.isOpen,
      city: merchant.city,
      area: merchant.area,
    };
  }
}
