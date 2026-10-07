import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from './expo-push.service';
import { WebPushService } from './web-push.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushService, WebPushService],
  exports: [NotificationsService, ExpoPushService, WebPushService],
})
export class NotificationsModule {}
