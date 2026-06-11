import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { PricingService } from './pricing.service';

@Global()
@Module({
  providers: [AccessService, PricingService],
  exports: [AccessService, PricingService],
})
export class SharedModule {}
