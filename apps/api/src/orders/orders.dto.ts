import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../common/constants';

export class PlaceOrderDto {
  @IsString()
  @IsNotEmpty()
  deliveryAddressId: string;

  @IsIn(Object.values(PaymentMethod))
  paymentMethod: string;

  @IsOptional()
  @IsString()
  customerNote?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RateOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  merchantRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  riderRating?: number;

  @IsOptional()
  @IsString()
  reviewText?: string;
}

export class OrderTicketDto {
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

export class ReplacementResponseDto {
  @IsBoolean()
  accept: boolean;
}

export class RejectOrderDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class AssignRiderDto {
  @IsString()
  @IsNotEmpty()
  riderId: string;
}

export class ItemUnavailableDto {
  @IsOptional()
  @IsString()
  replacementMerchantProductId?: string;
}
