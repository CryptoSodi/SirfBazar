import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';
import { PosService } from './pos.service';

class SaleItemDto {
  @IsString()
  merchantProductId: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedUnitPricePaisa?: number;
}

class CreateSaleDto {
  @IsOptional()
  @IsUUID('4')
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  counterName?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  amountTenderedPaisa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class ReviewProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  merchantProductIds: string[];
}

/** Web POS for merchant owners + staff (staff need the POS permission). */
@ApiTags('pos')
@Roles(UserRole.MERCHANT_OWNER, UserRole.MERCHANT_STAFF)
@Controller('pos')
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get('capabilities')
  capabilities(@CurrentUser() user: AuthUser) {
    return this.pos.capabilities(user.userId);
  }

  @Get('products/lookup')
  lookup(@CurrentUser() user: AuthUser, @Query('code') code: string) {
    return this.pos.lookupProduct(user.userId, code);
  }

  @Get('products')
  products(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.pos.listProducts(user.userId, q);
  }

  @Post('products/review')
  reviewProducts(@CurrentUser() user: AuthUser, @Body() dto: ReviewProductsDto) {
    return this.pos.listProducts(user.userId, undefined, dto.merchantProductIds);
  }

  @Post('sales')
  createSale(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.pos.createSale(user.userId, dto);
  }

  @Get('sales')
  sales(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.pos.listSales(user.userId, { from, to });
  }

  @Get('sales/:id')
  sale(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pos.saleDetail(user.userId, id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.pos.summary(user.userId, { from, to });
  }
}
