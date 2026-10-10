import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../common/constants';

export class PlaceOrderDto {
  /** Stable native checkout ID: retries return the same owned order. */
  @IsUUID('4')
  requestId: string;

  @IsString()
  @IsNotEmpty()
  cartId: string;

  @IsOptional()
  @IsString()
  approvedQuote?: string;

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

export class QuoteOrderDto {
  @IsString() @IsNotEmpty() cartId: string;
  @IsString() @IsNotEmpty() deliveryAddressId: string;
  @IsIn([PaymentMethod.COD]) paymentMethod: string;
  @IsOptional() @IsString() couponCode?: string;
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

export class OrderRevisionChangeDto {
  @IsString() @IsNotEmpty() @MaxLength(128)
  originalItemId: string;

  @IsIn(['REMOVE', 'REDUCE', 'REPLACE'])
  action: 'REMOVE' | 'REDUCE' | 'REPLACE';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  quantity?: number;

  @IsOptional() @IsString() @MaxLength(128)
  replacementMerchantProductId?: string;
}

export class CreateOrderRevisionDto {
  @IsUUID('4')
  requestId: string;

  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrderRevisionChangeDto)
  changes: OrderRevisionChangeDto[];
}

export class OrderRevisionResponseDto {
  @IsBoolean()
  accept: boolean;
}
