import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { ExpoPushService } from './expo-push.service';
import { AuthUser, CurrentUser } from '../common/decorators';

class PushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly expoPush: ExpoPushService,
  ) {}

  @Post('push-token')
  saveToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.expoPush.saveToken(user.userId, dto.token, dto.platform);
  }

  @Post('push-token/remove')
  removeToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.expoPush.removeToken(user.userId, dto.token);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.list(user.userId, unread === 'true');
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.userId);
  }
}
