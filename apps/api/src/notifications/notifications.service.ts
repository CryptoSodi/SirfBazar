import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ExpoPushService } from './expo-push.service';
import { WebPushService } from './web-push.service';
import { AuthUser } from '../common/decorators';
import { audienceAllowed, encodeAudience, NotificationAudience, parseAudience } from './notification-audience';
import { serializable } from '../common/transaction';
import { Prisma } from '@prisma/client';

export interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  referenceId?: string;
  audience: NotificationAudience;
  scopeId: string;
}

/**
 * Persists in-app notifications, pushes them over the websocket, and delivers
 * a device push (Expo) to the user's registered phones. New channels (SMS,
 * email) plug in here without touching call sites.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly expoPush: ExpoPushService,
    private readonly webPush: WebPushService,
  ) {}

  async notify(input: NotifyInput) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          body: input.body,
          type: encodeAudience({ audience: input.audience, scopeId: input.scopeId, baseType: input.type }),
          referenceId: input.referenceId ?? null,
        },
      });
      const projected = { ...notification, type: input.type, audience: input.audience, scopeId: input.scopeId };
      const audience = { audience: input.audience, scopeId: input.scopeId, baseType: input.type };
      // Context is checked by the gateway before delivery, not by user-room membership.
      this.realtime.emitToUser(input.userId, 'notification', projected);
      // Device push is fire-and-forget: it must never delay or fail the caller.
      void this.expoPush.sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        data: { type: input.type, referenceId: input.referenceId ?? null },
      }, audience);
      void this.webPush.sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        tag: notification.id,
        data: {
          type: input.type,
          referenceId: input.referenceId ?? null,
          url: input.type.toUpperCase().includes('ORDER') ? '/orders' : '/workspace',
        },
      }, audience);
      return projected;
    } catch (err) {
      // Notification failures must never break the business operation.
      this.logger.warn(`Failed to notify user ${input.userId}: ${err}`);
      return null;
    }
  }

  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
    await Promise.all(userIds.map((userId) => this.notify({ ...input, userId })));
  }

  private parseScope(scope?: string) {
    if (scope === undefined || scope === 'current') return 'current';
    if (scope === 'legacy') return 'legacy';
    throw new BadRequestException('Unknown notification scope');
  }

  private async eligible(user: AuthUser, row: { type: string }, scope: string, db: Prisma.TransactionClient = this.prisma, cache?: Map<string, boolean>) {
    const encoded = parseAudience(row.type);
    if (scope === 'legacy') return !encoded;
    if (!encoded) return false;
    const key = `${encoded.audience}:${encoded.scopeId}:${encoded.baseType}`;
    if (cache?.has(key)) return cache.get(key)!;
    const permitted = await audienceAllowed(db, user, encoded);
    cache?.set(key, permitted);
    return permitted;
  }

  async list(user: AuthUser, unreadOnly = false, requestedScope?: string) {
    const scope = this.parseScope(requestedScope);
    const result: any[] = [];
    const cache = new Map<string, boolean>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const rows = await this.prisma.notification.findMany({
        where: { userId: user.userId, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      for (const row of rows) {
        if (await this.eligible(user, row, scope, this.prisma, cache)) {
          const encoded = parseAudience(row.type);
          result.push(encoded ? { ...row, type: encoded.baseType, audience: encoded.audience, scopeId: encoded.scopeId } : { ...row, audience: 'LEGACY', scopeId: null });
          if (result.length === 100) return result;
        }
      }
      if (rows.length < 100) return result;
      cursor = rows.at(-1)!.id;
    }
    throw new ServiceUnavailableException('Notification history is too large to scan. Contact support.');
  }

  async markRead(user: AuthUser, notificationId: string, requestedScope?: string) {
    const scope = this.parseScope(requestedScope);
    await serializable(this.prisma, async (tx) => {
      const row = await tx.notification.findFirst({ where: { id: notificationId, userId: user.userId } });
      if (!row || !(await this.eligible(user, row, scope, tx))) return;
      await tx.notification.updateMany({ where: { id: notificationId, userId: user.userId }, data: { isRead: true } });
    });
    return { ok: true };
  }

  async markAllRead(user: AuthUser, requestedScope?: string) {
    const scope = this.parseScope(requestedScope);
    await serializable(this.prisma, async (tx) => {
      const cache = new Map<string, boolean>();
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const rows = await tx.notification.findMany({ where: { userId: user.userId, isRead: false }, select: { id: true, type: true }, orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!rows.length) return;
        const ids: string[] = [];
        for (const row of rows) if (await this.eligible(user, row, scope, tx, cache)) ids.push(row.id);
        if (ids.length) await tx.notification.updateMany({ where: { id: { in: ids }, userId: user.userId, isRead: false }, data: { isRead: true } });
        if (rows.length < 500) return;
        cursor = rows.at(-1)!.id;
      }
      throw new ServiceUnavailableException('Notification history is too large to mark all at once.');
    });
    return { ok: true };
  }
}
