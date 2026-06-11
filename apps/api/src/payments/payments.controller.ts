import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaymentsService } from './payments.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  providerTransactionId?: string;
}

class FailPaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('payments')
@Roles(UserRole.CUSTOMER)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('order/:orderId')
  listForOrder(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.listForOrder(user.userId, orderId);
  }

  @Post('order/:orderId/initiate')
  initiate(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.initiate(user.userId, orderId);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.payments.confirm(user.userId, id, dto.providerTransactionId);
  }

  @Post(':id/fail')
  fail(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FailPaymentDto) {
    return this.payments.fail(user.userId, id, dto.reason);
  }
}
