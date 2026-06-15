import { Module } from '@nestjs/common';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';
import { RiderApplyController } from './rider-apply.controller';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [OrdersModule, AuthModule],
  controllers: [RiderController, RiderApplyController],
  providers: [RiderService],
})
export class RiderModule {}
