import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminMarketplaceService } from './admin-marketplace.service';
import { AdminController } from './admin.controller';
import { OrdersModule } from '../orders/orders.module';
import { RefundsModule } from '../refunds/refunds.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [OrdersModule, RefundsModule, SettlementsModule, SupportModule],
  controllers: [AdminController],
  providers: [AdminService, AdminMarketplaceService],
})
export class AdminModule {}
