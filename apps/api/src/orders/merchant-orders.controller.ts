import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MerchantOrdersService } from './merchant-orders.service';
import { AssignRiderDto, CreateOrderRevisionDto, ItemUnavailableDto, RejectOrderDto } from './orders.dto';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

@ApiTags('merchant-orders')
@Roles(UserRole.MERCHANT_OWNER, UserRole.MERCHANT_STAFF)
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(private readonly service: MerchantOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List own online orders', description: 'Explicit page/pageSize returns {items,total,page,pageSize,totalPages}; omitting both preserves the legacy newest-100 array.' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'attention', required: false, type: Boolean, description: 'When true and status is absent, include actionable merchant statuses.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Maximum 100.' })
  list(@CurrentUser() user: AuthUser, @Query() query: { status?: string; attention?: string; page?: string; pageSize?: string }) {
    return this.service.list(user.userId, query);
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
    return this.service.proposeUnavailable(user.userId, id, itemId, dto.replacementMerchantProductId);
  }

  @Post(':id/revisions')
  createRevision(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateOrderRevisionDto) {
    return this.service.createRevision(user.userId, id, dto.requestId, dto.changes);
  }
}
