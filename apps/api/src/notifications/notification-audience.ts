import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/decorators';
import { StaffPermission, UserRole } from '../common/constants';

export type NotificationAudience = 'CUSTOMER' | 'MERCHANT' | 'RIDER' | 'ADMIN' | 'ACCOUNT';
export interface AudienceType { audience: NotificationAudience; scopeId: string; baseType: string }
const AUDIENCES = new Set<NotificationAudience>(['CUSTOMER', 'MERCHANT', 'RIDER', 'ADMIN', 'ACCOUNT']);
const PART = /^[A-Za-z0-9_-]+$/;

export function encodeAudience(value: AudienceType): string {
  if (!AUDIENCES.has(value.audience) || !PART.test(value.scopeId) || !PART.test(value.baseType)) {
    throw new BadRequestException('Invalid notification audience');
  }
  return `v1:${value.audience}:${value.scopeId}:${value.baseType}`;
}

export function parseAudience(value: string): AudienceType | null {
  const parts = value.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1' || !AUDIENCES.has(parts[1] as NotificationAudience) || !PART.test(parts[2]) || !PART.test(parts[3])) return null;
  return { audience: parts[1] as NotificationAudience, scopeId: parts[2], baseType: parts[3] };
}

const merchantPermission = (baseType: string): string => {
  if (baseType.includes('PRODUCT')) return StaffPermission.INVENTORY;
  if (baseType.includes('SETTLEMENT')) return StaffPermission.FINANCE;
  if (baseType.includes('RIDER') || baseType === 'RIDER_REQUEST') return StaffPermission.RIDERS;
  return StaffPermission.ORDERS;
};

export async function audienceAllowed(db: Prisma.TransactionClient, user: AuthUser, item: AudienceType): Promise<boolean> {
  const active = await db.user.findUnique({ where: { id: user.userId }, select: { status: true } });
  if (active?.status !== 'ACTIVE') return false;
  if (item.audience === 'ACCOUNT') return item.scopeId === user.userId;
  if (item.audience === 'ADMIN') return item.scopeId === user.role && ([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.FINANCE_ADMIN] as UserRole[]).includes(user.role);
  if (item.audience === 'CUSTOMER') {
    if (user.role !== UserRole.CUSTOMER || item.scopeId !== user.userId) return false;
    return !!(await db.customer.findUnique({ where: { userId: user.userId }, select: { id: true } }));
  }
  if (item.audience === 'RIDER') {
    if (user.role !== UserRole.RIDER) return false;
    return !!(await db.rider.findFirst({ where: { id: item.scopeId, userId: user.userId, isActive: true, approvalStatus: 'APPROVED' }, select: { id: true } }));
  }
  if (user.role === UserRole.MERCHANT_OWNER) {
    return !!(await db.merchant.findFirst({ where: { id: item.scopeId, userId: user.userId }, select: { id: true } }));
  }
  if (user.role !== UserRole.MERCHANT_STAFF) return false;
  const staff = await db.merchantStaff.findFirst({ where: { merchantId: item.scopeId, userId: user.userId, status: 'ACTIVE' }, select: { permissions: true } });
  if (!staff) return false;
  let permissions: string[] = [];
  try { permissions = JSON.parse(staff.permissions || '[]'); } catch { return false; }
  return permissions.includes(merchantPermission(item.baseType));
}
