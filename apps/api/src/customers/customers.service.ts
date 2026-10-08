import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { ACTIVE_ORDER_STATUSES } from '../common/constants';
import { lockOwners } from '../common/owner-lock';
import { serializable } from '../common/transaction';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        profileImageUrl: true,
        isPhoneVerified: true,
        isEmailVerified: true,
        createdAt: true,
        customer: {
          select: { id: true, walletBalancePaisa: true, loyaltyPoints: true, defaultAddressId: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    userId: string,
    input: { fullName?: string; email?: string; profileImageUrl?: string },
  ) {
    if (input.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: input.email, id: { not: userId } },
      });
      if (taken) throw new BadRequestException('Email is already in use');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName ?? undefined,
        email: input.email ?? undefined,
        profileImageUrl: input.profileImageUrl ?? undefined,
        ...(input.email ? { isEmailVerified: false } : {}),
      },
    });
    return this.profile(userId);
  }

  async listAddresses(userId: string) {
    const customerId = await this.access.customerId(userId);
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, input: any) {
    const customerId = await this.access.customerId(userId);
    return serializable(this.prisma, async (tx) => {
    await lockOwners(tx, { customerIds: [customerId] });
    const count = await tx.customerAddress.count({ where: { customerId } });
    const makeDefault = input.isDefault === true || count === 0;

    const address = await tx.customerAddress.create({
      data: {
        customerId,
        label: input.label ?? 'Home',
        fullAddress: input.fullAddress,
        street: input.street ?? null,
        area: input.area ?? null,
        city: input.city,
        province: input.province ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        instructions: input.instructions ?? null,
        isDefault: makeDefault,
      },
    });
    if (makeDefault) await this.setDefaultInternal(tx, customerId, address.id);
    return address;
    });
  }

  async updateAddress(userId: string, addressId: string, input: any) {
    const customerId = await this.access.customerId(userId);
    return serializable(this.prisma, async (tx) => {
    await lockOwners(tx, { customerIds: [customerId] });
    const existing = await tx.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const deliveryFields = ['fullAddress', 'street', 'area', 'city', 'province', 'latitude', 'longitude', 'contactName', 'contactPhone', 'instructions'] as const;
    const changingDelivery = deliveryFields.some((field) => input[field] !== undefined && input[field] !== existing[field]);
    if (changingDelivery) await this.assertAddressUnused(tx, addressId);

    const address = await tx.customerAddress.update({
      where: { id: addressId },
      data: {
        label: input.label ?? undefined,
        fullAddress: input.fullAddress ?? undefined,
        street: input.street ?? undefined,
        area: input.area ?? undefined,
        city: input.city ?? undefined,
        province: input.province ?? undefined,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        contactName: input.contactName ?? undefined,
        contactPhone: input.contactPhone ?? undefined,
        instructions: input.instructions ?? undefined,
      },
    });
    if (input.isDefault === true) await this.setDefaultInternal(tx, customerId, addressId);
    return address;
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const customerId = await this.access.customerId(userId);
    return serializable(this.prisma, async (tx) => {
    await lockOwners(tx, { customerIds: [customerId] });
    const existing = await tx.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');
    // The Order→address FK is optional (nulls on delete), so deleting an address
    // tied to an in-progress order would silently strip the rider's drop-off.
    await this.assertAddressUnused(tx, addressId);
    await tx.customerAddress.delete({ where: { id: addressId } });
    if (existing.isDefault) {
      const next = await tx.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });
      await tx.customer.update({
        where: { id: customerId },
        data: { defaultAddressId: next?.id ?? null },
      });
      if (next) {
        await tx.customerAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { ok: true };
    });
  }

  async setDefault(userId: string, addressId: string) {
    const customerId = await this.access.customerId(userId);
    return serializable(this.prisma, async (tx) => {
    await lockOwners(tx, { customerIds: [customerId] });
    const existing = await tx.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');
    await this.setDefaultInternal(tx, customerId, addressId);
    return { ok: true };
    });
  }

  private async assertAddressUnused(tx: Prisma.TransactionClient, addressId: string) {
    const activeOrder = await tx.order.findFirst({ where: { deliveryAddressId: addressId, status: { in: ACTIVE_ORDER_STATUSES } }, select: { id: true } });
    if (activeOrder) throw new ConflictException({ code: 'ADDRESS_IN_USE', message: 'This address is used by an active order. Add a new address instead.' });
  }

  private async setDefaultInternal(tx: Prisma.TransactionClient, customerId: string, addressId: string) {
    await tx.customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false },
      });
    await tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    await tx.customer.update({
        where: { id: customerId },
        data: { defaultAddressId: addressId },
      });
  }

  /** Soft delete per spec 10.13 — account becomes unusable, history retained. */
  async deleteAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
