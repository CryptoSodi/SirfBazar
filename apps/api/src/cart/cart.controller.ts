import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto, ApplyCouponDto, CartLocationQuery, UpdateCartItemDto } from './cart.dto';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';

/** Logged-in customer cart (guest cart lives under /api/guest/cart). */
@ApiTags('cart')
@Roles(UserRole.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async view(@CurrentUser() user: AuthUser, @Query() q: CartLocationQuery) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    const location =
      q.latitude != null && q.longitude != null
        ? { latitude: q.latitude, longitude: q.longitude }
        : undefined;
    return this.cart.view(owner, location);
  }

  @Post('items')
  async addItem(@CurrentUser() user: AuthUser, @Body() dto: AddCartItemDto) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    return this.cart.addItem(owner, dto.merchantProductId, dto.quantity);
  }

  @Put('items/:id')
  async updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    return this.cart.updateItem(owner, id, dto.quantity);
  }

  @Delete('items/:id')
  async removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    return this.cart.removeItem(owner, id);
  }

  @Delete('clear')
  async clear(@CurrentUser() user: AuthUser) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    return this.cart.clear(owner);
  }

  @Post('apply-coupon')
  async applyCoupon(@CurrentUser() user: AuthUser, @Body() dto: ApplyCouponDto) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    return this.cart.applyCoupon(owner, dto.code);
  }

  @Delete('remove-coupon')
  async removeCoupon(@CurrentUser() user: AuthUser) {
    const owner = await this.cart.ownerFromCustomerUser(user.userId);
    return this.cart.removeCoupon(owner);
  }
}
