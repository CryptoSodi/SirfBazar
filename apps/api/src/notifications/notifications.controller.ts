import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { ExpoPushService } from './expo-push.service';
import { WebPushService } from './web-push.service';
import { AuthUser, CurrentUser } from '../common/decorators';

class PushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}

class WebPushSubscriptionDto {
  @IsString() @IsNotEmpty()
  endpoint: string;

  @IsString() @IsNotEmpty()
  p256dh: string;

  @IsString() @IsNotEmpty()
  auth: string;
}

class WebPushUnsubscribeDto {
  @IsString() @IsNotEmpty()
  endpoint: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly expoPush: ExpoPushService,
    private readonly webPush: WebPushService,
  ) {}

  @Get('web-push/config')
  webPushConfig() {
    return this.webPush.configuration();
  }

  @Post('web-push/subscribe')
  subscribeWebPush(
    @CurrentUser() user: AuthUser,
    @Body() dto: WebPushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.webPush.subscribe(user, {
      endpoint: dto.endpoint,
      keys: { p256dh: dto.p256dh, auth: dto.auth },
    }, userAgent);
  }

  @Post('web-push/unsubscribe')
  unsubscribeWebPush(@CurrentUser() user: AuthUser, @Body() dto: WebPushUnsubscribeDto) {
    return this.webPush.unsubscribe(user, dto.endpoint);
  }

  @Post('push-token')
  saveToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.expoPush.saveToken(user, dto.token, dto.platform);
  }

  @Post('push-token/remove')
  removeToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.expoPush.removeToken(user, dto.token);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string, @Query('scope') scope?: string) {
    return this.notifications.list(user, unread === 'true', scope);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('scope') scope?: string) {
    return this.notifications.markRead(user, id, scope);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    return this.notifications.markAllRead(user, scope);
  }
}
