import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SupportService } from './support.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

class CreateTicketDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsString()
  @IsNotEmpty()
  issueCategory: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

class TicketMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

@ApiTags('support')
@Roles(UserRole.CUSTOMER, UserRole.MERCHANT_OWNER, UserRole.MERCHANT_STAFF, UserRole.RIDER)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.support.create(user.userId, user.role, dto);
  }

  @Get('tickets')
  listOwn(@CurrentUser() user: AuthUser) {
    return this.support.listOwn(user.userId);
  }

  @Get('tickets/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.support.getForUser(user.userId, user.role, id);
  }

  @Post('tickets/:id/messages')
  addMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TicketMessageDto) {
    return this.support.addMessage(user.userId, user.role, id, dto.message);
  }
}
