import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, StaffPermission, UserRole } from '../common/constants';
import { CreateRiderDto, CreateStaffDto, UpdateRiderDto, UpdateStaffDto } from './merchant.dto';
import { serializable } from '../common/transaction';

/** Merchant-managed riders and staff (spec 12.9 / 12.10). */
@Injectable()
export class MerchantPeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Riders ─────────────────────────────────────────────────────────────────

  async listRiders(userId: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.RIDERS);
    return this.prisma.rider.findMany({
      where: { merchantId: ctx.merchantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getRider(userId: string, riderId: string) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.RIDERS);
    const rider = await this.prisma.rider.findFirst({
      where: { id: riderId, merchantId: ctx.merchantId },
    });
    if (!rider) throw new NotFoundException('Rider not found in your shop');
    return rider;
  }

  async createRider(userId: string, dto: CreateRiderDto) {
    const ctx = await this.access.merchantContext(userId);
    this.access.requirePermission(ctx, StaffPermission.RIDERS);

    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
      include: { rider: true },
    });
    if (existingUser?.rider) {
      throw new BadRequestException('This phone number is already registered as a rider');
    }

    const rider = await this.prisma.$transaction(async (tx) => {
      // Attach a rider profile to the existing account if the phone is already
      // registered (so a customer can also be a rider); otherwise provision one.
      const riderUserId =
        existingUser?.id ??
        (
          await tx.user.create({
            data: {
              phoneNumber: dto.phoneNumber,
              fullName: dto.fullName,
              role: UserRole.RIDER,
            },
          })
        ).id;
      return tx.rider.create({
        data: {
          merchantId: ctx.merchantId,
          userId: riderUserId,
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          vehicleType: dto.vehicleType ?? 'MOTORBIKE',
          vehicleNumber: dto.vehicleNumber ?? null,
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'RIDER_CREATED',
      entityType: 'Rider',
      entityId: rider.id,
      newValue: { fullName: rider.fullName, merchantId: ctx.merchantId },
    });
    return rider;
  }

  async updateRider(userId: string, riderId: string, dto: UpdateRiderDto) {
    const rider = await this.getRider(userId, riderId);
    return this.prisma.rider.update({
      where: { id: rider.id },
      data: {
        fullName: dto.fullName ?? undefined,
        vehicleType: dto.vehicleType ?? undefined,
        vehicleNumber: dto.vehicleNumber ?? undefined,
        profileImageUrl: dto.profileImageUrl ?? undefined,
      },
    });
  }

  async setRiderActive(userId: string, riderId: string, active: boolean) {
    const rider = await this.getRider(userId, riderId);
    await serializable(this.prisma, async (tx) => {
      const claimed = await tx.rider.updateMany({
        where: { id: rider.id, merchantId: rider.merchantId, approvalStatus: 'APPROVED', ...(!active ? { currentOrderId: null } : {}) },
        data: { isActive: active, ...(active ? {} : { isOnline: false }) },
      });
      if (claimed.count !== 1) throw new BadRequestException('Rider approval or delivery changed. Refresh before continuing.');
      await tx.auditLog.create({ data: { userId, role: 'MERCHANT', action: active ? 'RIDER_ACTIVATED' : 'RIDER_DEACTIVATED', entityType: 'Rider', entityId: rider.id } });
    });
    await this.notifications.notify({
      userId: rider.userId,
      audience: 'ACCOUNT', scopeId: rider.userId,
      title: active ? 'You are active again' : 'Account deactivated',
      body: active
        ? 'Your shop has re-activated your rider account.'
        : 'Your shop has deactivated your rider account. Contact the shop owner for details.',
      type: NotificationType.SYSTEM,
    });
    return { ok: true, isActive: active };
  }

  /** Approve a rider who applied to this shop. */
  async approveRider(userId: string, riderId: string) {
    const rider = await this.getRider(userId, riderId);
    const updated = await serializable(this.prisma, async (tx) => {
      const claimed = await tx.rider.updateMany({ where: { id: rider.id, merchantId: rider.merchantId, approvalStatus: 'PENDING', currentOrderId: null }, data: { approvalStatus: 'APPROVED', isActive: true } });
      if (claimed.count !== 1) throw new BadRequestException('Rider request changed. Refresh before continuing.');
      await tx.auditLog.create({ data: { userId, role: 'MERCHANT', action: 'RIDER_APPROVED', entityType: 'Rider', entityId: rider.id } });
      return tx.rider.findUniqueOrThrow({ where: { id: rider.id } });
    });
    await this.notifications.notify({
      userId: rider.userId,
      audience: 'ACCOUNT', scopeId: rider.userId,
      title: 'Rider request approved 🎉',
      body: 'Your shop approved you — you can start accepting deliveries.',
      type: NotificationType.SYSTEM,
    });
    return updated;
  }

  /** Decline a pending rider request (removes the rider profile so they can re-apply). */
  async rejectRider(userId: string, riderId: string) {
    const rider = await this.getRider(userId, riderId);
    // Reject only ever removes a fresh applicant. An APPROVED rider may hold orders
    // (Order.riderId would be nulled on delete) — deactivate those instead.
    if (rider.approvalStatus !== 'PENDING') {
      throw new BadRequestException(
        'Only a pending rider request can be rejected — deactivate an approved rider instead.',
      );
    }
    await serializable(this.prisma, async (tx) => {
      const assignedOrder = await tx.order.findFirst({ where: { riderId: rider.id }, select: { id: true } });
      if (assignedOrder) throw new BadRequestException('Rider has order history and cannot be removed');
      const removed = await tx.rider.deleteMany({ where: { id: rider.id, merchantId: rider.merchantId, approvalStatus: 'PENDING', currentOrderId: null } });
      if (removed.count !== 1) throw new BadRequestException('Rider request changed. Refresh before continuing.');
      await tx.auditLog.create({ data: { userId, role: 'MERCHANT', action: 'RIDER_REJECTED', entityType: 'Rider', entityId: rider.id } });
    });
    await this.notifications.notify({
      userId: rider.userId,
      audience: 'ACCOUNT', scopeId: rider.userId,
      title: 'Rider request declined',
      body: 'Your request to join the shop was declined. You can apply to another shop.',
      type: NotificationType.SYSTEM,
    });
    return { ok: true };
  }

  async riderOrders(userId: string, riderId: string) {
    const rider = await this.getRider(userId, riderId);
    return this.prisma.order.findMany({
      where: { riderId: rider.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmountPaisa: true,
        paymentMethod: true,
        createdAt: true,
        deliveredAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Staff (owner only) ─────────────────────────────────────────────────────

  async listStaff(userId: string) {
    const ctx = await this.access.merchantContext(userId);
    if (!ctx.isOwner) throw new BadRequestException('Only the shop owner can manage staff');
    const staff = await this.prisma.merchantStaff.findMany({
      where: { merchantId: ctx.merchantId },
      include: { user: { select: { fullName: true, phoneNumber: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return staff.map((s) => ({ ...s, permissions: JSON.parse(s.permissions) }));
  }

  async createStaff(userId: string, dto: CreateStaffDto) {
    const ctx = await this.access.merchantContext(userId);
    if (!ctx.isOwner) throw new BadRequestException('Only the shop owner can manage staff');

    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (existingUser) {
      throw new BadRequestException('This phone number already belongs to another account');
    }

    const staff = await this.prisma.$transaction(async (tx) => {
      const staffUser = await tx.user.create({
        data: {
          phoneNumber: dto.phoneNumber,
          fullName: dto.fullName,
          role: UserRole.MERCHANT_STAFF,
        },
      });
      return tx.merchantStaff.create({
        data: {
          merchantId: ctx.merchantId,
          userId: staffUser.id,
          roleName: dto.roleName,
          permissions: JSON.stringify(dto.permissions),
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'STAFF_CREATED',
      entityType: 'MerchantStaff',
      entityId: staff.id,
      newValue: { roleName: dto.roleName, permissions: dto.permissions },
    });
    return { ...staff, permissions: dto.permissions };
  }

  async updateStaff(userId: string, staffId: string, dto: UpdateStaffDto) {
    const ctx = await this.access.merchantContext(userId);
    if (!ctx.isOwner) throw new BadRequestException('Only the shop owner can manage staff');
    const existing = await this.prisma.merchantStaff.findFirst({
      where: { id: staffId, merchantId: ctx.merchantId },
    });
    if (!existing) throw new NotFoundException('Staff member not found');

    const staff = await this.prisma.merchantStaff.update({
      where: { id: staffId },
      data: {
        roleName: dto.roleName ?? undefined,
        permissions: dto.permissions ? JSON.stringify(dto.permissions) : undefined,
        status: dto.status ?? undefined,
      },
    });
    return { ...staff, permissions: JSON.parse(staff.permissions) };
  }

  async removeStaff(userId: string, staffId: string) {
    const ctx = await this.access.merchantContext(userId);
    if (!ctx.isOwner) throw new BadRequestException('Only the shop owner can manage staff');
    const result = await this.prisma.merchantStaff.updateMany({
      where: { id: staffId, merchantId: ctx.merchantId },
      data: { status: 'DISABLED' },
    });
    if (result.count === 0) throw new NotFoundException('Staff member not found');
    return { ok: true };
  }
}
