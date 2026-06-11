import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatusService } from '../orders/order-status.service';
import { RefundsService } from '../refunds/refunds.service';
import {
  CANCELLED_ORDER_STATUSES,
  MerchantApprovalStatus,
  NotificationType,
  OrderStatus,
  ProductApprovalStatus,
  RefundStatus,
} from '../common/constants';
import { parsePage, paged, PageQuery } from '../common/utils/pagination';
import { randomBytes } from 'crypto';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Admin operations over merchants, orders, products, categories, coupons, refunds. */
@Injectable()
export class AdminMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly orders: OrdersService,
    private readonly statusService: OrderStatusService,
    private readonly refunds: RefundsService,
  ) {}

  // ── Merchants ──────────────────────────────────────────────────────────────

  async listMerchants(query: PageQuery & { status?: string; q?: string }) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where: any = {};
    if (query.status) where.approvalStatus = query.status;
    if (query.q) {
      where.OR = [
        { shopName: { contains: query.q } },
        { city: { contains: query.q } },
        { phoneNumber: { contains: query.q } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        include: {
          user: { select: { fullName: true, phoneNumber: true, email: true } },
          _count: { select: { orders: true, products: true, riders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.merchant.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async merchantDetail(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true, email: true, status: true } },
        documents: true,
        staff: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
        _count: { select: { orders: true, products: true, riders: true } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  async setMerchantApproval(
    adminUserId: string,
    merchantId: string,
    status: string,
    reason?: string,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { user: { select: { id: true } } },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        approvalStatus: status,
        ...(status !== MerchantApprovalStatus.APPROVED ? { isOnline: false } : {}),
      },
    });

    const titles: Record<string, [string, string]> = {
      [MerchantApprovalStatus.APPROVED]: [
        'Shop approved 🎉',
        `${merchant.shopName} is now live on SirfBazar. Go online to start receiving orders.`,
      ],
      [MerchantApprovalStatus.REJECTED]: [
        'Application rejected',
        `Your application for ${merchant.shopName} was rejected${reason ? `: ${reason}` : '.'}`,
      ],
      [MerchantApprovalStatus.SUSPENDED]: [
        'Shop suspended',
        `${merchant.shopName} has been suspended${reason ? `: ${reason}` : '.'} Contact support.`,
      ],
    };
    const note = titles[status];
    if (note) {
      await this.notifications.notify({
        userId: merchant.user.id,
        title: note[0],
        body: note[1],
        type: NotificationType.SYSTEM,
        referenceId: merchantId,
      });
    }
    await this.audit.log({
      userId: adminUserId,
      action: `MERCHANT_${status}`,
      entityType: 'Merchant',
      entityId: merchantId,
      oldValue: { approvalStatus: merchant.approvalStatus },
      newValue: { approvalStatus: status, reason },
    });
    return { ok: true, approvalStatus: status };
  }

  async updateMerchant(
    adminUserId: string,
    merchantId: string,
    input: { commissionType?: string; commissionValue?: number; serviceRadiusKm?: number },
  ) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const updated = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        commissionType: input.commissionType ?? undefined,
        commissionValue: input.commissionValue ?? undefined,
        serviceRadiusKm: input.serviceRadiusKm ?? undefined,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'MERCHANT_TERMS_UPDATED',
      entityType: 'Merchant',
      entityId: merchantId,
      oldValue: {
        commissionType: merchant.commissionType,
        commissionValue: merchant.commissionValue,
        serviceRadiusKm: merchant.serviceRadiusKm,
      },
      newValue: input,
    });
    return updated;
  }

  merchantRiders(merchantId: string) {
    return this.prisma.rider.findMany({ where: { merchantId }, orderBy: { createdAt: 'asc' } });
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async listOrders(query: PageQuery & { status?: string; merchantId?: string; customerId?: string; q?: string }) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where: any = { isParent: false };
    if (query.status) where.status = query.status;
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.q) where.orderNumber = { contains: query.q.toUpperCase() };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          merchant: { select: { shopName: true } },
          customer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
          rider: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async orderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        merchant: { select: { id: true, shopName: true, phoneNumber: true } },
        customer: { select: { id: true, user: { select: { fullName: true, phoneNumber: true } } } },
        rider: { select: { id: true, fullName: true, phoneNumber: true } },
        deliveryAddress: true,
        payments: true,
        refunds: true,
        children: { include: { items: true, merchant: { select: { shopName: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async cancelOrder(adminUserId: string, orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { children: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const terminal = [OrderStatus.DELIVERED, ...CANCELLED_ORDER_STATUSES] as string[];
    const targets = (order.isParent ? order.children : [order]).filter(
      (o) => !terminal.includes(o.status),
    );
    if (targets.length === 0) throw new BadRequestException('Order is already completed or cancelled');

    for (const child of targets) {
      await this.orders.restoreStock(child.id);
      await this.statusService.apply(
        child.id,
        OrderStatus.CANCELLED_BY_ADMIN,
        { userId: adminUserId, role: 'ADMIN', notes: reason },
        { cancellationReason: reason, cancelledAt: new Date() },
      );
    }
    if (order.isParent) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED_BY_ADMIN,
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      });
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { userId: true },
    });
    if (customer) {
      await this.notifications.notify({
        userId: customer.userId,
        title: 'Order cancelled',
        body: `Order ${order.orderNumber} was cancelled by SirfBazar: ${reason}. Any payment will be refunded.`,
        type: NotificationType.ORDER_CANCELLED,
        referenceId: order.id,
      });
    }
    await this.orders.refundIfPaid(order.parentOrderId ?? order.id, order.customerId, `Admin cancellation: ${reason}`);
    await this.audit.log({
      userId: adminUserId,
      action: 'ORDER_CANCELLED_BY_ADMIN',
      entityType: 'Order',
      entityId: orderId,
      newValue: { reason },
    });
    return { ok: true };
  }

  async refundOrder(adminUserId: string, orderId: string, amountPaisa: number | undefined, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const amount = amountPaisa ?? order.totalAmountPaisa;
    if (amount > order.totalAmountPaisa) {
      throw new BadRequestException('Refund cannot exceed the order total');
    }
    const refund = await this.refunds.create({
      orderId,
      customerId: order.customerId,
      amountPaisa: amount,
      reason,
      autoApprove: true,
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'ORDER_REFUNDED_BY_ADMIN',
      entityType: 'Order',
      entityId: orderId,
      newValue: { amountPaisa: amount, reason },
    });
    return refund;
  }

  async overrideOrderStatus(adminUserId: string, orderId: string, status: string, reason: string) {
    if (!Object.values(OrderStatus).includes(status as any)) {
      throw new BadRequestException(`Unknown order status ${status}`);
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    await this.statusService.apply(orderId, status as OrderStatus, {
      userId: adminUserId,
      role: 'ADMIN',
      notes: `Manual override: ${reason}`,
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'ORDER_STATUS_OVERRIDE',
      entityType: 'Order',
      entityId: orderId,
      oldValue: { status: order.status },
      newValue: { status, reason },
    });
    return { ok: true, status };
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async listProducts(query: PageQuery & { approvalStatus?: string; q?: string }) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where: any = {};
    if (query.approvalStatus) where.approvalStatus = query.approvalStatus;
    if (query.q) where.name = { contains: query.q };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { merchantProducts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async createProduct(adminUserId: string, input: any) {
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new BadRequestException('Category not found');
    let slug = slugify(input.name);
    if (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${slug}-${randomBytes(2).toString('hex')}`;
    }
    const product = await this.prisma.product.create({
      data: {
        name: input.name,
        slug,
        brand: input.brand ?? null,
        description: input.description ?? null,
        categoryId: input.categoryId,
        imageUrl: input.imageUrl ?? null,
        unit: input.unit ?? 'piece',
        size: input.size ?? null,
        approvalStatus: ProductApprovalStatus.APPROVED,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      newValue: { name: product.name },
    });
    return product;
  }

  async updateProduct(adminUserId: string, productId: string, input: any) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: input.name ?? undefined,
        brand: input.brand ?? undefined,
        description: input.description ?? undefined,
        categoryId: input.categoryId ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        unit: input.unit ?? undefined,
        size: input.size ?? undefined,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: productId,
    });
    return updated;
  }

  async setProductApproval(adminUserId: string, productId: string, status: string, reason?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id: productId },
      data: { approvalStatus: status },
    });

    // Tell the merchant who requested this product.
    if (product.createdByMerchantId && (status === 'APPROVED' || status === 'REJECTED')) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: product.createdByMerchantId },
        select: { userId: true },
      });
      if (merchant) {
        await this.notifications.notify({
          userId: merchant.userId,
          title: status === 'APPROVED' ? 'Product approved' : 'Product rejected',
          body:
            status === 'APPROVED'
              ? `"${product.name}" was approved and is now visible to customers.`
              : `"${product.name}" was rejected${reason ? `: ${reason}` : '.'}`,
          type:
            status === 'APPROVED'
              ? NotificationType.PRODUCT_APPROVED
              : NotificationType.PRODUCT_REJECTED,
          referenceId: productId,
        });
      }
    }
    await this.audit.log({
      userId: adminUserId,
      action: `PRODUCT_${status}`,
      entityType: 'Product',
      entityId: productId,
      oldValue: { approvalStatus: product.approvalStatus },
      newValue: { approvalStatus: status, reason },
    });
    return { ok: true, approvalStatus: status };
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  listCategories() {
    return this.prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(adminUserId: string, input: any) {
    let slug = slugify(input.name);
    if (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${slug}-${randomBytes(2).toString('hex')}`;
    }
    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        parentCategoryId: input.parentCategoryId ?? null,
        iconUrl: input.iconUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: category.id,
      newValue: { name: category.name },
    });
    return category;
  }

  async updateCategory(adminUserId: string, categoryId: string, input: any) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: input.name ?? undefined,
        iconUrl: input.iconUrl ?? undefined,
        bannerUrl: input.bannerUrl ?? undefined,
        sortOrder: input.sortOrder ?? undefined,
        isActive: input.isActive ?? undefined,
        parentCategoryId: input.parentCategoryId ?? undefined,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: categoryId,
    });
    return updated;
  }

  async deleteCategory(adminUserId: string, categoryId: string) {
    const productCount = await this.prisma.product.count({ where: { categoryId } });
    if (productCount > 0) {
      throw new BadRequestException(
        `Category has ${productCount} products — move or delete them first`,
      );
    }
    await this.prisma.category.delete({ where: { id: categoryId } });
    await this.audit.log({
      userId: adminUserId,
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: categoryId,
    });
    return { ok: true };
  }

  // ── Coupons ────────────────────────────────────────────────────────────────

  listCoupons() {
    return this.prisma.coupon.findMany({
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(adminUserId: string, input: any) {
    const code = String(input.code).trim().toUpperCase();
    if (await this.prisma.coupon.findUnique({ where: { code } })) {
      throw new BadRequestException('Coupon code already exists');
    }
    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        title: input.title,
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxDiscountAmountPaisa: input.maxDiscountAmountPaisa ?? null,
        minimumOrderAmountPaisa: input.minimumOrderAmountPaisa ?? 0,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        usageLimitTotal: input.usageLimitTotal ?? null,
        usageLimitPerCustomer: input.usageLimitPerCustomer ?? 1,
        newUsersOnly: input.newUsersOnly ?? false,
        applicableMerchantId: input.applicableMerchantId ?? null,
        applicableCategoryId: input.applicableCategoryId ?? null,
        applicableCity: input.applicableCity ?? null,
        paymentMethodRestriction: input.paymentMethodRestriction ?? null,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'COUPON_CREATED',
      entityType: 'Coupon',
      entityId: coupon.id,
      newValue: { code, discountType: input.discountType, discountValue: input.discountValue },
    });
    return coupon;
  }

  async updateCoupon(adminUserId: string, couponId: string, input: any) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const updated = await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        title: input.title ?? undefined,
        description: input.description ?? undefined,
        discountValue: input.discountValue ?? undefined,
        maxDiscountAmountPaisa: input.maxDiscountAmountPaisa ?? undefined,
        minimumOrderAmountPaisa: input.minimumOrderAmountPaisa ?? undefined,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        usageLimitTotal: input.usageLimitTotal ?? undefined,
        usageLimitPerCustomer: input.usageLimitPerCustomer ?? undefined,
        newUsersOnly: input.newUsersOnly ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'COUPON_UPDATED',
      entityType: 'Coupon',
      entityId: couponId,
    });
    return updated;
  }

  async deactivateCoupon(adminUserId: string, couponId: string) {
    await this.prisma.coupon.update({ where: { id: couponId }, data: { isActive: false } });
    await this.audit.log({
      userId: adminUserId,
      action: 'COUPON_DEACTIVATED',
      entityType: 'Coupon',
      entityId: couponId,
    });
    return { ok: true };
  }

  // ── Refunds ────────────────────────────────────────────────────────────────

  async listRefunds(query: PageQuery & { status?: string }) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, merchant: { select: { shopName: true } } } },
          customer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async setRefundStatus(adminUserId: string, refundId: string, action: 'approve' | 'reject', notes?: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('Refund not found');
    const allowed = [RefundStatus.REQUESTED, RefundStatus.UNDER_REVIEW] as string[];
    if (!allowed.includes(refund.status)) {
      throw new BadRequestException(`Refund is ${refund.status}; cannot ${action}`);
    }
    const status = action === 'approve' ? RefundStatus.APPROVED : RefundStatus.REJECTED;
    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: { status, adminNotes: notes ?? refund.adminNotes },
    });
    await this.audit.log({
      userId: adminUserId,
      action: `REFUND_${status}`,
      entityType: 'Refund',
      entityId: refundId,
      newValue: { notes },
    });
    return updated;
  }

  async processRefund(adminUserId: string, refundId: string) {
    const result = await this.refunds.process(refundId);
    await this.audit.log({
      userId: adminUserId,
      action: 'REFUND_PROCESSED',
      entityType: 'Refund',
      entityId: refundId,
    });
    return result;
  }
}
