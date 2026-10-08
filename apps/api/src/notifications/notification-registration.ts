import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthUser } from '../common/decorators';
import { UserRole } from '../common/constants';
import { AudienceType, audienceAllowed } from './notification-audience';
import { serializable } from '../common/transaction';
import { PrismaService } from '../prisma/prisma.service';

const ENTITY = 'NotificationRegistration';
export type RegistrationChannel = 'expo' | 'web';
export type RegistrationAction = 'REGISTER' | 'TRANSFER' | 'REVOKE';
export interface RegistrationEvent {
  channel: RegistrationChannel;
  registrationId: string;
  ownerUserId: string;
  audience: AudienceType['audience'];
  scopeId: string;
  sessionId: string;
  action: RegistrationAction;
}

export function registrationId(channel: RegistrationChannel, credential: string) {
  return `${channel}:${createHash('sha256').update(credential).digest('hex')}`;
}

export async function latestRegistration(tx: Prisma.TransactionClient, id: string): Promise<RegistrationEvent | null> {
  const row = await tx.auditLog.findFirst({ where: { entityType: ENTITY, entityId: id }, orderBy: { id: 'desc' } });
  if (!row?.newValue) return null;
  try { return JSON.parse(row.newValue) as RegistrationEvent; } catch { return null; }
}

export async function registrationAudience(tx: Prisma.TransactionClient, user: AuthUser): Promise<AudienceType> {
  if (!user.sessionId) throw new UnauthorizedException('Refresh your session before registering notifications');
  const session = await tx.refreshToken.findFirst({ where: { id: user.sessionId, userId: user.userId, role: user.role, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (!session) throw new UnauthorizedException('Session is no longer active');
  const role = user.role;
  let result: AudienceType;
  if (role === UserRole.CUSTOMER) result = { audience: 'CUSTOMER', scopeId: user.userId, baseType: 'SYSTEM' };
  else if (role === UserRole.RIDER) {
    const rider = await tx.rider.findUnique({ where: { userId: user.userId }, select: { id: true } });
    if (!rider) throw new UnauthorizedException('Rider membership changed');
    result = { audience: 'RIDER', scopeId: rider.id, baseType: 'SYSTEM' };
  } else if (role === UserRole.MERCHANT_OWNER) {
    const merchant = await tx.merchant.findUnique({ where: { userId: user.userId }, select: { id: true } });
    if (!merchant) throw new UnauthorizedException('Shop membership changed');
    result = { audience: 'MERCHANT', scopeId: merchant.id, baseType: 'NEW_ORDER' };
  } else if (role === UserRole.MERCHANT_STAFF) {
    const staff = await tx.merchantStaff.findFirst({ where: { userId: user.userId, status: 'ACTIVE' }, select: { merchantId: true, permissions: true }, orderBy: { createdAt: 'desc' } });
    if (!staff) throw new UnauthorizedException('Shop membership changed');
    let permissions: string[] = [];
    try { permissions = JSON.parse(staff.permissions || '[]'); } catch { /* fail below */ }
    const baseType = permissions.includes('ORDERS') ? 'NEW_ORDER' : permissions.includes('RIDERS') ? 'RIDER_REQUEST' : permissions.includes('INVENTORY') ? 'PRODUCT_APPROVED' : permissions.includes('FINANCE') ? 'SETTLEMENT_UPDATE' : null;
    if (!baseType) throw new UnauthorizedException('No notification permission for this shop');
    result = { audience: 'MERCHANT', scopeId: staff.merchantId, baseType };
  } else result = { audience: 'ADMIN', scopeId: role, baseType: 'SYSTEM' };
  if (!(await audienceAllowed(tx, user, result))) throw new UnauthorizedException('Notification context is no longer available');
  return result;
}

export async function appendRegistration(tx: Prisma.TransactionClient, event: RegistrationEvent) {
  // Registration rows are locked by callers. A deterministic sequence preserves
  // causal order even when several audit writes share the same millisecond.
  const prior = await tx.auditLog.findFirst({ where: { entityType: ENTITY, entityId: event.registrationId }, orderBy: { id: 'desc' }, select: { id: true } });
  const previousSequence = prior && prior.id.startsWith(`${event.registrationId}:`) ? Number(prior.id.slice(-12)) : 0;
  const sequence = previousSequence + 1;
  if (!Number.isSafeInteger(sequence) || sequence > 999_999_999_999) throw new ConflictException('Notification registration history is unavailable');
  await tx.auditLog.create({ data: {
    id: `${event.registrationId}:${String(sequence).padStart(12, '0')}`,
    userId: event.ownerUserId, role: event.audience, action: `NOTIFICATION_REGISTRATION_${event.action}`,
    entityType: ENTITY, entityId: event.registrationId, newValue: JSON.stringify(event),
  } });
}

export async function registerForSession(tx: Prisma.TransactionClient, user: AuthUser, channel: RegistrationChannel, credential: string, currentOwnerUserId?: string) {
  const audience = await registrationAudience(tx, user);
  const id = registrationId(channel, credential);
  const prior = await latestRegistration(tx, id);
  if (prior && prior.action !== 'REVOKE' && currentOwnerUserId && prior.ownerUserId !== currentOwnerUserId) {
    throw new ConflictException('Notification registration ownership changed');
  }
  // A device may already have been claimed by a newer login for the same
  // account. Comparing only user ids lets a delayed old-session callback
  // replace that claim and later revoke it on logout.
  if (prior && prior.action !== 'REVOKE' && prior.sessionId !== user.sessionId) {
    const oldSession = await tx.refreshToken.findUnique({ where: { id: prior.sessionId }, select: { createdAt: true } });
    const newSession = await tx.refreshToken.findUnique({ where: { id: user.sessionId! }, select: { createdAt: true } });
    if (oldSession && newSession && oldSession.createdAt >= newSession.createdAt) throw new ConflictException('A newer session owns this device');
  }
  await appendRegistration(tx, { channel, registrationId: id, ownerUserId: user.userId, audience: audience.audience, scopeId: audience.scopeId, sessionId: user.sessionId!, action: 'REGISTER' });
  return id;
}

export async function transferRegistrations(tx: Prisma.TransactionClient, userId: string, oldSessionId: string, newSessionId: string) {
  const registrations = [
    ...(await tx.pushToken.findMany({ where: { userId }, select: { token: true } })).map((row) => ({ id: registrationId('expo', row.token), channel: 'expo' as const, credential: row.token })),
    ...(await tx.webPushSubscription.findMany({ where: { userId }, select: { endpoint: true } })).map((row) => ({ id: registrationId('web', row.endpoint), channel: 'web' as const, credential: row.endpoint })),
  ];
  for (const registration of registrations.sort((a, b) => a.id.localeCompare(b.id))) {
    if (registration.channel === 'expo') await tx.$queryRaw(Prisma.sql`SELECT id FROM "PushToken" WHERE "userId" = ${userId} AND token = ${registration.credential} FOR UPDATE`);
    else await tx.$queryRaw(Prisma.sql`SELECT id FROM "WebPushSubscription" WHERE "userId" = ${userId} AND endpoint = ${registration.credential} FOR UPDATE`);
    const prior = await latestRegistration(tx, registration.id);
    if (!prior || prior.ownerUserId !== userId || prior.sessionId !== oldSessionId || prior.action === 'REVOKE') continue;
    await appendRegistration(tx, { ...prior, sessionId: newSessionId, action: 'TRANSFER' });
  }
}

export async function revokeSessionRegistrations(tx: Prisma.TransactionClient, userId: string, sessionId: string) {
  for (const row of await tx.pushToken.findMany({ where: { userId }, select: { token: true } })) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "PushToken" WHERE "userId" = ${userId} AND token = ${row.token} FOR UPDATE`);
    const prior = await latestRegistration(tx, registrationId('expo', row.token));
    if (!prior || prior.ownerUserId !== userId || prior.sessionId !== sessionId || prior.action === 'REVOKE') continue;
    await tx.pushToken.deleteMany({ where: { userId, token: row.token } });
    await appendRegistration(tx, { ...prior, action: 'REVOKE' });
  }
  for (const row of await tx.webPushSubscription.findMany({ where: { userId }, select: { endpoint: true } })) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "WebPushSubscription" WHERE "userId" = ${userId} AND endpoint = ${row.endpoint} FOR UPDATE`);
    const prior = await latestRegistration(tx, registrationId('web', row.endpoint));
    if (!prior || prior.ownerUserId !== userId || prior.sessionId !== sessionId || prior.action === 'REVOKE') continue;
    await tx.webPushSubscription.deleteMany({ where: { userId, endpoint: row.endpoint } });
    await appendRegistration(tx, { ...prior, action: 'REVOKE' });
  }
}

export async function registrationCanReceive(tx: Prisma.TransactionClient, channel: RegistrationChannel, credential: string, ownerUserId: string, item: AudienceType) {
  const prior = await latestRegistration(tx, registrationId(channel, credential));
  if (!prior || prior.action === 'REVOKE' || prior.ownerUserId !== ownerUserId) return false;
  if (item.audience === 'ACCOUNT' ? item.scopeId !== ownerUserId : prior.audience !== item.audience || prior.scopeId !== item.scopeId) return false;
  const session = await tx.refreshToken.findFirst({ where: { id: prior.sessionId, userId: ownerUserId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { role: true } });
  return !!session && !!session.role && audienceAllowed(tx, { userId: ownerUserId, role: session.role as UserRole, sessionId: prior.sessionId }, item);
}

/** A provider error is only evidence about the registration sent, not a later owner. */
export async function pruneFailedRegistration(prisma: PrismaService, channel: RegistrationChannel, credential: string, sent: RegistrationEvent) {
  await serializable(prisma, async (tx) => {
    if (channel === 'expo') {
      const row = await tx.pushToken.findUnique({ where: { token: credential }, select: { id: true, userId: true } });
      if (!row || row.userId !== sent.ownerUserId) return;
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "PushToken" WHERE id = ${row.id} FOR UPDATE`);
    } else {
      const row = await tx.webPushSubscription.findUnique({ where: { endpoint: credential }, select: { id: true, userId: true } });
      if (!row || row.userId !== sent.ownerUserId) return;
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "WebPushSubscription" WHERE id = ${row.id} FOR UPDATE`);
    }
    const current = await latestRegistration(tx, registrationId(channel, credential));
    if (!current || current.ownerUserId !== sent.ownerUserId || current.sessionId !== sent.sessionId ||
        current.audience !== sent.audience || current.scopeId !== sent.scopeId || current.action !== sent.action) return;
    if (channel === 'expo') await tx.pushToken.deleteMany({ where: { token: credential, userId: sent.ownerUserId } });
    else await tx.webPushSubscription.deleteMany({ where: { endpoint: credential, userId: sent.ownerUserId } });
    await appendRegistration(tx, { ...current, action: 'REVOKE' });
  });
}
