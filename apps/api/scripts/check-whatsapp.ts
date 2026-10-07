import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppError, WhatsAppService } from '../src/whatsapp/whatsapp.service';

async function main() {
  await ConfigModule.forRoot();
  const result = await new WhatsAppService().ready();
  console.log(JSON.stringify(result));
  if (!result.ready) process.exitCode = 1;
}

void main().catch(error => {
  // Never print raw provider errors, request options, environment values or credentials.
  console.error(JSON.stringify({ ready: false, code: error instanceof WhatsAppError ? error.code : 'WHATSAPP_UNAVAILABLE' }));
  process.exitCode = 1;
});
