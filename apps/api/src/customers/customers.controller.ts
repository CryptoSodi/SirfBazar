import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomersService } from './customers.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}

class AddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @IsNotEmpty()
  fullAddress: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class UpdateAddressDto extends AddressDto {
  @IsOptional()
  @IsString()
  declare fullAddress: string;

  @IsOptional()
  @IsString()
  declare city: string;
}

@ApiTags('customer')
@Roles(UserRole.CUSTOMER)
@Controller('customer')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.customers.profile(user.userId);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.customers.updateProfile(user.userId, dto);
  }

  @Get('addresses')
  addresses(@CurrentUser() user: AuthUser) {
    return this.customers.listAddresses(user.userId);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.customers.createAddress(user.userId, dto);
  }

  @Put('addresses/:id')
  updateAddress(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.customers.updateAddress(user.userId, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.deleteAddress(user.userId, id);
  }

  @Put('addresses/:id/default')
  setDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.setDefault(user.userId, id);
  }

  @Delete('account')
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.customers.deleteAccount(user.userId);
  }
}
