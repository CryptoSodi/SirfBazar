import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../common/transaction';

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
  async saveToken(userId: string, sessionId: string | undefined, token: string, platform?: string) {
    if (!/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token)) {
      return { ok: false, reason: 'Not an Expo push token' };
    }
    if (!sessionId) throw new UnauthorizedException('Refresh your session before registering push notifications');
    await serializable(this.prisma, async (tx) => {
      const session = await tx.refreshToken.findFirst({
        where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!session) throw new UnauthorizedException('Session is no longer active');
      const existing = await tx.pushToken.findUnique({ where: { token } });
      // updatedAt records the most recent registering session's creation time.
      // An older session cannot move a shared device token back after a switch.
      if (existing && existing.updatedAt > session.createdAt) {
        throw new ConflictException('A newer session owns this device token');
      }
      await tx.pushToken.upsert({
        where: { token },
        update: { userId, platform: platform ?? undefined, updatedAt: session.createdAt },
        create: { userId, token, platform: platform ?? 'android', updatedAt: session.createdAt },
      });
    });
    return { ok: true };
  }

  /** Drop a device token (called on logout so the device stops getting alerts). */
  async removeToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
    return { ok: true };
  }

  /** Fire-and-forget push to every device a user has registered. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const messages = tokens.map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      }));

      for (let i = 0; i < messages.length; i += CHUNK) {
        const batch = messages.slice(i, i + CHUNK);
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push HTTP ${res.status}`);
          continue;
        }
        const out: any = await res.json().catch(() => null);
        const tickets: any[] = out?.data ?? [];
        // Prune tokens Expo says are gone (app uninstalled / token rotated).
        const dead = tickets
          .map((ticket, idx) => ({ ticket, to: batch[idx]?.to }))
          .filter(({ ticket }) => ticket?.details?.error === 'DeviceNotRegistered')
          .map(({ to }) => to)
          .filter(Boolean) as string[];
        if (dead.length > 0) {
          await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
          this.logger.log(`Pruned ${dead.length} dead push token(s)`);
        }
      }
    } catch (err) {
      this.logger.warn(`Push to user ${userId} failed: ${err}`);
    }
  }
}
