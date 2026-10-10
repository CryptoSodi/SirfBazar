import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CancelOrderDto,
  OrderTicketDto,
  PlaceOrderDto,
  QuoteOrderDto,
  RateOrderDto,
  OrderRevisionResponseDto,
  ReplacementResponseDto,
} from './orders.dto';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

@ApiTags('orders')
@Roles(UserRole.CUSTOMER)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('quote')
  quote(@CurrentUser() user: AuthUser, @Body() dto: QuoteOrderDto) {
    return this.orders.quoteOrder(user.userId, dto);
  }

  @Post()
  place(@CurrentUser() user: AuthUser, @Body() dto: PlaceOrderDto) {
    return this.orders.placeOrder(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.orders.listForCustomer(user.userId, status);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.detailForCustomer(user.userId, id);
  }

  @Get(':id/track')
  track(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.track(user.userId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancelByCustomer(user.userId, id, dto.reason);
  }

  @Post(':id/rate')
  rate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RateOrderDto) {
    return this.orders.rate(user.userId, id, dto);
  }

  @Post(':id/support-ticket')
  supportTicket(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OrderTicketDto) {
    return this.orders.createSupportTicket(user.userId, id, dto);
  }

  @Post(':id/items/:itemId/replacement')
  respondReplacement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReplacementResponseDto,
  ) {
    return this.orders.respondToReplacement(user.userId, id, itemId, dto.accept);
  }

  @Post(':id/revisions/:revisionId/respond')
  respondRevision(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: OrderRevisionResponseDto,
  ) {
    return this.orders.respondToRevision(user.userId, id, revisionId, dto.accept);
  }
}
