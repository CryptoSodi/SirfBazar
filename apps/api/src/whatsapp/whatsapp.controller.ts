import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/constants';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@Roles(UserRole.ADMIN)
@Controller('admin/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('ready')
  async ready() {
    const result = await this.whatsapp.ready();
    if (!result.ready) throw new ServiceUnavailableException({ ready: false });
    return result;
  }
}
