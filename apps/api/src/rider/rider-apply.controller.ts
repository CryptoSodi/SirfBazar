import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RiderService } from './rider.service';
import { AuthUser, CurrentUser } from '../common/decorators';

class ApplyRiderDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}

/**
 * Rider self-onboarding — any authenticated user (not yet a rider) can browse
 * shops and apply; the shop then approves the request. No @Roles guard so a
 * brand-new account can reach it (same pattern as merchant onboarding).
 */
@ApiTags('rider')
@Controller('rider')
export class RiderApplyController {
  constructor(private readonly rider: RiderService) {}

  @Get('shops')
  shops(@Query('q') q?: string) {
    return this.rider.listShops(q);
  }

  @Post('apply')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyRiderDto) {
    return this.rider.applyAsRider(user.userId, dto);
  }
}
