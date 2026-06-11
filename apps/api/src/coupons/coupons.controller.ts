import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { Public } from '../common/decorators';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Public()
  @Get()
  listActive() {
    return this.coupons.listActive();
  }
}
