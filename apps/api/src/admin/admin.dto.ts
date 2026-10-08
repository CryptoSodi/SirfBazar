import { IsIn, IsString, Length } from 'class-validator';
import { OrderStatus } from '../common/constants';

export class OverrideOrderStatusDto {
  @IsIn([OrderStatus.MERCHANT_ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP])
  status: string;

  @IsString()
  @Length(3, 500)
  reason: string;
}
