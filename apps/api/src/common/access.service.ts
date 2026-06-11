import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffPermission } from './constants';

export interface MerchantContext {
  merchantId: string;
  isOwner: boolean;
  permissions: StaffPermission[];
}

/**
 * Resolves "which merchant does this user act for" — owner or active staff.
 * Enforces the core multi-tenancy rule: a merchant user can only ever
 * operate on their own shop.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async merchantContext(userId: string): Promise<MerchantContext> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (merchant) {
      return {
        merchantId: merchant.id,
        isOwner: true,
        permissions: Object.values(StaffPermission),
      };
    }
    const staff = await this.prisma.merchantStaff.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    if (staff) {
      let permissions: StaffPermission[] = [];
      try {
        permissions = JSON.parse(staff.permissions);
      } catch {
        permissions = [];
      }
      return { merchantId: staff.merchantId, isOwner: false, permissions };
    }
    throw new ForbiddenException('No merchant account linked to this user');
  }

  requirePermission(ctx: MerchantContext, permission: StaffPermission) {
    if (ctx.isOwner) return;
    if (!ctx.permissions.includes(permission)) {
      throw new ForbiddenException(`Staff permission ${permission} required`);
    }
  }

  async customerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');
    return customer.id;
  }

  async riderByUser(userId: string) {
    const rider = await this.prisma.rider.findUnique({ where: { userId } });
    if (!rider) throw new NotFoundException('Rider profile not found');
    return rider;
  }

  /** Users to notify for a merchant: the owner plus all active staff. */
  async merchantUserIds(merchantId: string): Promise<string[]> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { userId: true, staff: { where: { status: 'ACTIVE' }, select: { userId: true } } },
    });
    if (!merchant) return [];
    return [merchant.userId, ...merchant.staff.map((s) => s.userId)];
  }
}
