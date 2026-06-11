import { Module } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantProductsService } from './merchant-products.service';
import { MerchantPeopleService } from './merchant-people.service';
import { MerchantController, MerchantOnboardController } from './merchant.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MerchantOnboardController, MerchantController],
  providers: [MerchantService, MerchantProductsService, MerchantPeopleService],
})
export class MerchantModule {}
