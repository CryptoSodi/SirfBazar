import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AuthUser, CurrentUser, GuestToken, Public } from '../common/decorators';
import { AddCartItemDto, ApplyCouponDto, UpdateCartItemDto } from '../cart/cart.dto';
import { generateToken } from '../common/utils/ids';

class CreateGuestSessionDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

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
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;
}

const GUEST_SESSION_TTL_DAYS = 30;

@ApiTags('guest')
@Controller('guest')
export class GuestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
  ) {}

  @Public()
  @Post('session')
  async createSession(@Body() dto: CreateGuestSessionDto) {
    const session = await this.prisma.guestSession.create({
      data: {
        sessionToken: generateToken(24),
        deviceId: dto.deviceId ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        city: dto.city ?? null,
        area: dto.area ?? null,
        expiresAt: new Date(Date.now() + GUEST_SESSION_TTL_DAYS * 86400_000),
      },
    });
    return { sessionToken: session.sessionToken, expiresAt: session.expiresAt };
  }

  @Public()
  @Put('session/location')
  async updateLocation(@GuestToken() token: string, @Body() dto: CreateGuestSessionDto) {
    const owner = await this.cart.ownerFromGuestToken(token);
    await this.prisma.guestSession.update({
      where: { id: owner.guestSessionId },
      data: {
        latitude: dto.latitude ?? undefined,
        longitude: dto.longitude ?? undefined,
        city: dto.city ?? undefined,
        area: dto.area ?? undefined,
      },
    });
    return { ok: true };
  }

  @Public()
  @Get('cart')
  async viewCart(
    @GuestToken() token: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    const owner = await this.cart.ownerFromGuestToken(token);
    const location =
      latitude && longitude
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : await this.sessionLocation(owner.guestSessionId!);
    return this.cart.view(owner, location);
  }

  @Public()
  @Post('cart/items')
  async addItem(@GuestToken() token: string, @Body() dto: AddCartItemDto) {
    const owner = await this.cart.ownerFromGuestToken(token);
    return this.cart.addItem(owner, dto.merchantProductId, dto.quantity);
  }

  @Public()
  @Put('cart/items/:id')
  async updateItem(
    @GuestToken() token: string,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const owner = await this.cart.ownerFromGuestToken(token);
    return this.cart.updateItem(owner, id, dto.quantity);
  }

  @Public()
  @Delete('cart/items/:id')
  async removeItem(@GuestToken() token: string, @Param('id') id: string) {
    const owner = await this.cart.ownerFromGuestToken(token);
    return this.cart.removeItem(owner, id);
  }

  @Public()
  @Post('cart/apply-coupon')
  async applyCoupon(@GuestToken() token: string, @Body() dto: ApplyCouponDto) {
    const owner = await this.cart.ownerFromGuestToken(token);
    return this.cart.applyCoupon(owner, dto.code);
  }

  /** Requires BOTH the guest header and a fresh customer JWT (login at checkout). */
  @Post('cart/merge-after-login')
  async merge(@GuestToken() token: string, @CurrentUser() user: AuthUser) {
    return this.cart.mergeGuestCart(token, user.userId);
  }

  private async sessionLocation(guestSessionId: string) {
    const session = await this.prisma.guestSession.findUnique({ where: { id: guestSessionId } });
    if (session?.latitude != null && session?.longitude != null) {
      return { latitude: session.latitude, longitude: session.longitude };
    }
    return undefined;
  }
}
