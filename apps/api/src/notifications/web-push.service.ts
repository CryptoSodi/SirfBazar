import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import webpush, { PushSubscription } from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { AudienceType } from './notification-audience';
import { appendRegistration, latestRegistration, pruneFailedRegistration, registerForSession, registrationCanReceive, registrationId } from './notification-registration';
import { serializable } from '../common/transaction';
import { Prisma } from '@prisma/client';

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

  async subscribe(user: AuthUser, subscription: BrowserSubscription, userAgent?: string) {
    if (!this.enabled) return { enabled: false };
    if (!user.sessionId) throw new UnauthorizedException('Refresh your session before registering notifications');
    await serializable(this.prisma, async (tx) => {
    const existing = await tx.webPushSubscription.findUnique({ where: { endpoint: subscription.endpoint } });
    if (existing) await tx.$queryRaw(Prisma.sql`SELECT id FROM "WebPushSubscription" WHERE id = ${existing.id} FOR UPDATE`);
    await tx.webPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: user.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500) || null,
      },
      update: {
        userId: user.userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });
    await registerForSession(tx, user, 'web', subscription.endpoint, existing?.userId);
    });
    return { enabled: true, subscribed: true };
  }

  async unsubscribe(user: AuthUser, endpoint: string) {
    await serializable(this.prisma, async (tx) => {
      const row = await tx.webPushSubscription.findFirst({ where: { userId: user.userId, endpoint }, select: { id: true } });
      if (!row) return;
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "WebPushSubscription" WHERE id = ${row.id} FOR UPDATE`);
      const prior = await latestRegistration(tx, registrationId('web', endpoint));
      if (!prior || prior.ownerUserId !== user.userId || prior.sessionId !== user.sessionId || prior.action === 'REVOKE') return;
      await tx.webPushSubscription.deleteMany({ where: { userId: user.userId, endpoint } });
      await appendRegistration(tx, { ...prior, action: 'REVOKE' });
    });
    return { unsubscribed: true };
  }

  async sendToUser(userId: string, payload: Record<string, unknown>, audience: AudienceType) {
    if (!this.enabled) return;
    const subscriptions = await this.prisma.webPushSubscription.findMany({ where: { userId } });
    await Promise.all(subscriptions.map(async (stored) => {
      if (!(await registrationCanReceive(this.prisma, 'web', stored.endpoint, userId, audience))) return;
      const sentRegistration = await latestRegistration(this.prisma, registrationId('web', stored.endpoint));
      if (!sentRegistration || !(await registrationCanReceive(this.prisma, 'web', stored.endpoint, userId, audience))) return;
      const subscription: PushSubscription = {
        endpoint: stored.endpoint,
        keys: { p256dh: stored.p256dh, auth: stored.auth },
      };
      try {
        if (!(await registrationCanReceive(this.prisma, 'web', stored.endpoint, userId, audience))) return;
        await webpush.sendNotification(subscription, JSON.stringify({ ...payload, audience: audience.audience, scopeId: audience.scopeId }), { TTL: 300, urgency: 'high' });
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await pruneFailedRegistration(this.prisma, 'web', stored.endpoint, sentRegistration).catch(() => undefined);
          return;
        }
        this.logger.warn(`Browser push delivery failed for subscription ${stored.id}`);
      }
    }));
  }
}
