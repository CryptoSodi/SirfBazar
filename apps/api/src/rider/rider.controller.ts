import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { RiderService } from './rider.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

class LocationDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  speed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}

class OptionalLocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

class DeliveredDto {
  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class ReportIssueDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}

@ApiTags('rider')
@Roles(UserRole.RIDER)
@Controller('rider')
export class RiderController {
  constructor(private readonly rider: RiderService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.rider.profile(user.userId);
  }

  @Post('online')
  online(@CurrentUser() user: AuthUser) {
    return this.rider.setOnline(user.userId, true);
  }

  @Post('offline')
  offline(@CurrentUser() user: AuthUser) {
    return this.rider.setOnline(user.userId, false);
  }

  @Post('location')
  location(@CurrentUser() user: AuthUser, @Body() dto: LocationDto) {
    return this.rider.updateLocation(user.userId, dto);
  }

  @Get('orders/assigned')
  assigned(@CurrentUser() user: AuthUser) {
    return this.rider.assignedOrders(user.userId);
  }

  @Get('orders/history')
  history(@CurrentUser() user: AuthUser) {
    return this.rider.history(user.userId);
  }

  @Get('orders/:id')
  orderDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rider.orderDetail(user.userId, id);
  }

  @Post('orders/:id/arrived-shop')
  arrivedShop(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OptionalLocationDto) {
    return this.rider.arrivedAtShop(user.userId, id, dto);
  }

  @Post('orders/:id/picked-up')
  pickedUp(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OptionalLocationDto) {
    return this.rider.pickedUp(user.userId, id, dto);
  }

  @Post('orders/:id/arrived-customer')
  arrivedCustomer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OptionalLocationDto) {
    return this.rider.arrivedAtCustomer(user.userId, id, dto);
  }

  @Post('orders/:id/delivered')
  delivered(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DeliveredDto) {
    return this.rider.delivered(user.userId, id, dto);
  }

  @Post('orders/:id/report-issue')
  reportIssue(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReportIssueDto) {
    return this.rider.reportIssue(user.userId, id, dto.description);
  }
}
