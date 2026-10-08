import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../common/transaction';
import { AuthUser } from '../common/decorators';
import { AudienceType } from './notification-audience';
import { appendRegistration, latestRegistration, pruneFailedRegistration, registerForSession, registrationCanReceive, registrationId, RegistrationEvent } from './notification-registration';
import { Prisma } from '@prisma/client';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo push API max messages per request

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Delivers notifications to the Expo push service (customer/merchant/rider apps).
 * Plain HTTP — no SDK dependency. Failures are logged, never thrown: push is a
 * best-effort channel on top of the persisted in-app notification.
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger('ExpoPush');

  constructor(private readonly prisma: PrismaService) {}

  /** Register (or re-assign to this user) a device token. */
  async saveToken(user: AuthUser, token: string, platform?: string) {
    if (!/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token)) {
      return { ok: false, reason: 'Not an Expo push token' };
    }
    if (!user.sessionId) throw new UnauthorizedException('Refresh your session before registering push notifications');
    await serializable(this.prisma, async (tx) => {
      const session = await tx.refreshToken.findFirst({
        where: { id: user.sessionId, userId: user.userId, role: user.role, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!session) throw new UnauthorizedException('Session is no longer active');
      const existing = await tx.pushToken.findUnique({ where: { token } });
      if (existing) await tx.$queryRaw(Prisma.sql`SELECT id FROM "PushToken" WHERE id = ${existing.id} FOR UPDATE`);
      // updatedAt records the most recent registering session's creation time.
      // An older session cannot move a shared device token back after a switch.
      if (existing && existing.updatedAt > session.createdAt) {
        throw new ConflictException('A newer session owns this device token');
      }
      await tx.pushToken.upsert({
        where: { token },
        update: { userId: user.userId, platform: platform ?? undefined, updatedAt: session.createdAt },
        create: { userId: user.userId, token, platform: platform ?? 'android', updatedAt: session.createdAt },
      });
      await registerForSession(tx, user, 'expo', token, existing?.userId);
    });
    return { ok: true };
  }

  /** Drop a device token (called on logout so the device stops getting alerts). */
  async removeToken(user: AuthUser, token: string) {
    await serializable(this.prisma, async (tx) => {
      const row = await tx.pushToken.findFirst({ where: { token, userId: user.userId }, select: { id: true } });
      if (!row) return;
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "PushToken" WHERE id = ${row.id} FOR UPDATE`);
      const prior = await latestRegistration(tx, registrationId('expo', token));
      if (!prior || prior.ownerUserId !== user.userId || prior.sessionId !== user.sessionId || prior.action === 'REVOKE') return;
      await tx.pushToken.deleteMany({ where: { token, userId: user.userId } });
      await appendRegistration(tx, { ...prior, action: 'REVOKE' });
    });
    return { ok: true };
  }

  /** Fire-and-forget push to every device a user has registered. */
  async sendToUser(userId: string, payload: PushPayload, audience: AudienceType): Promise<void> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const eligible = [] as typeof tokens;
      for (const token of tokens) if (await registrationCanReceive(this.prisma, 'expo', token.token, userId, audience)) eligible.push(token);
      const messages = eligible.map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: { ...(payload.data ?? {}), audience: audience.audience, scopeId: audience.scopeId },
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      }));

      for (let i = 0; i < messages.length; i += CHUNK) {
        const batch = messages.slice(i, i + CHUNK);
        const current: Array<{ message: typeof batch[number]; registration: RegistrationEvent }> = [];
        for (const message of batch) {
          const registration = await latestRegistration(this.prisma, registrationId('expo', message.to));
          if (registration && await registrationCanReceive(this.prisma, 'expo', message.to, userId, audience)) current.push({ message, registration });
        }
        if (!current.length) continue;
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(current.map(({ message }) => message)),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push HTTP ${res.status}`);
          continue;
        }
        const out: any = await res.json().catch(() => null);
        const tickets: any[] = out?.data ?? [];
        // Prune tokens Expo says are gone (app uninstalled / token rotated).
        const dead = tickets
          .map((ticket, idx) => ({ ticket, sent: current[idx] }))
          .filter(({ ticket }) => ticket?.details?.error === 'DeviceNotRegistered')
          .map(({ sent }) => sent)
          .filter(Boolean) as typeof current;
        if (dead.length > 0) {
          for (const { message, registration } of dead) await pruneFailedRegistration(this.prisma, 'expo', message.to, registration);
          this.logger.log(`Pruned ${dead.length} dead push token(s)`);
        }
      }
    } catch (err) {
      this.logger.warn(`Push to user ${userId} failed: ${err}`);
    }
  }
}
