import { Injectable, Logger } from '@nestjs/common';
import webpush, { PushSubscription } from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

@Injectable()
export class WebPushService {
  private readonly logger = new Logger('WebPush');
  private readonly publicKey: string | null;
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    let publicKey = process.env.VAPID_PUBLIC_KEY || '';
    let privateKey = process.env.VAPID_PRIVATE_KEY || '';
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@sirfbazar.com';

    if ((!publicKey || !privateKey) && process.env.NODE_ENV !== 'production' && process.env.WEB_PUSH_AUTO_GENERATE === 'true') {
      const generated = webpush.generateVAPIDKeys();
      publicKey = generated.publicKey;
      privateKey = generated.privateKey;
      this.logger.warn('Using temporary development VAPID keys. Browser subscriptions will be renewed after an API restart.');
    }

    this.enabled = Boolean(publicKey && privateKey);
    this.publicKey = this.enabled ? publicKey : null;
    if (this.enabled) webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  configuration() {
    return { enabled: this.enabled, publicKey: this.publicKey };
  }

  async subscribe(userId: string, subscription: BrowserSubscription, userAgent?: string) {
    if (!this.enabled) return { enabled: false };
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500) || null,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });
    return { enabled: true, subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.webPushSubscription.deleteMany({ where: { userId, endpoint } });
    return { unsubscribed: true };
  }

  async sendToUser(userId: string, payload: Record<string, unknown>) {
    if (!this.enabled) return;
    const subscriptions = await this.prisma.webPushSubscription.findMany({ where: { userId } });
    await Promise.all(subscriptions.map(async (stored) => {
      const subscription: PushSubscription = {
        endpoint: stored.endpoint,
        keys: { p256dh: stored.p256dh, auth: stored.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 300, urgency: 'high' });
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await this.prisma.webPushSubscription.delete({ where: { id: stored.id } }).catch(() => undefined);
          return;
        }
        this.logger.warn(`Browser push delivery failed for subscription ${stored.id}`);
      }
    }));
  }
}
