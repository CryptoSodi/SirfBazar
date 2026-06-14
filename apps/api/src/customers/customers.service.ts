import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { ACTIVE_ORDER_STATUSES } from '../common/constants';

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
    const count = await this.prisma.customerAddress.count({ where: { customerId } });
    const makeDefault = input.isDefault === true || count === 0;

    const address = await this.prisma.customerAddress.create({
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
    if (makeDefault) await this.setDefaultInternal(customerId, address.id);
    return address;
  }

  async updateAddress(userId: string, addressId: string, input: any) {
    const customerId = await this.access.customerId(userId);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const address = await this.prisma.customerAddress.update({
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
    if (input.isDefault === true) await this.setDefaultInternal(customerId, addressId);
    return address;
  }

  async deleteAddress(userId: string, addressId: string) {
    const customerId = await this.access.customerId(userId);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');
    // The Order→address FK is optional (nulls on delete), so deleting an address
    // tied to an in-progress order would silently strip the rider's drop-off.
    const activeOrder = await this.prisma.order.findFirst({
      where: { deliveryAddressId: addressId, status: { in: ACTIVE_ORDER_STATUSES } },
      select: { id: true },
    });
    if (activeOrder) {
      throw new BadRequestException('This address is being used by an active order and cannot be deleted right now.');
    }
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
    if (existing.isDefault) {
      const next = await this.prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { defaultAddressId: next?.id ?? null },
      });
      if (next) {
        await this.prisma.customerAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { ok: true };
  }

  async setDefault(userId: string, addressId: string) {
    const customerId = await this.access.customerId(userId);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException('Address not found');
    await this.setDefaultInternal(customerId, addressId);
    return { ok: true };
  }

  private async setDefaultInternal(customerId: string, addressId: string) {
    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false },
      }),
      this.prisma.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
      this.prisma.customer.update({
        where: { id: customerId },
        data: { defaultAddressId: addressId },
      }),
    ]);
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
