import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MerchantOrdersService } from './merchant-orders.service';
import { AssignRiderDto, ItemUnavailableDto, RejectOrderDto } from './orders.dto';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

@ApiTags('merchant-orders')
@Roles(UserRole.MERCHANT_OWNER, UserRole.MERCHANT_STAFF)
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(private readonly service: MerchantOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.list(user.userId, status);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.detail(user.userId, id);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.accept(user.userId, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.service.reject(user.userId, id, dto.reason);
  }

  @Post(':id/preparing')
  preparing(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markPreparing(user.userId, id);
  }

  @Post(':id/ready')
  ready(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markReady(user.userId, id);
  }

  @Post(':id/assign-rider')
  assignRider(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignRiderDto) {
    return this.service.assignRider(user.userId, id, dto.riderId);
  }

  @Post(':id/items/:itemId/unavailable')
  itemUnavailable(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ItemUnavailableDto,
  ) {
    return this.service.markItemUnavailable(user.userId, id, itemId, dto.replacementMerchantProductId);
  }
}
