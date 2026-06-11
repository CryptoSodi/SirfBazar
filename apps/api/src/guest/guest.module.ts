import { Module } from '@nestjs/common';
import { GuestController } from './guest.controller';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [CartModule],
  controllers: [GuestController],
})
export class GuestModule {}
