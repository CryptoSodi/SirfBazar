import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';
import { PosService } from './pos.service';

class SaleItemDto {
  @IsString()
  merchantProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

class CreateSaleDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  amountTenderedPaisa?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

/** Web POS for merchant owners + staff (staff need the POS permission). */
@ApiTags('pos')
@Roles(UserRole.MERCHANT_OWNER, UserRole.MERCHANT_STAFF)
@Controller('pos')
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get('products')
  products(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.pos.listProducts(user.userId, q);
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
