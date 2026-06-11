import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatusService } from './order-status.service';
import { MerchantOrdersService } from './merchant-orders.service';
import { OrdersController } from './orders.controller';
import { MerchantOrdersController } from './merchant-orders.controller';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { RefundsModule } from '../refunds/refunds.module';

@Module({
  imports: [CartModule, CouponsModule, RefundsModule],
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService, OrderStatusService, MerchantOrdersService],
  exports: [OrdersService, OrderStatusService],
})
export class OrdersModule {}
