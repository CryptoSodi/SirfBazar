import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ExpoPushService } from './expo-push.service';

export interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  referenceId?: string;
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
  ) {}

  async notify(input: NotifyInput) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          body: input.body,
          type: input.type,
          referenceId: input.referenceId ?? null,
        },
      });
      this.realtime.emitToUser(input.userId, 'notification', notification);
      // Device push is fire-and-forget: it must never delay or fail the caller.
      void this.expoPush.sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        data: { type: input.type, referenceId: input.referenceId ?? null },
      });
      return notification;
    } catch (err) {
      // Notification failures must never break the business operation.
      this.logger.warn(`Failed to notify user ${input.userId}: ${err}`);
      return null;
    }
  }

  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
    await Promise.all(userIds.map((userId) => this.notify({ ...input, userId })));
  }

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
