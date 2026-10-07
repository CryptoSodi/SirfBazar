import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OTP_SERVICE } from './otp/otp.interface';
import { MockOtpService } from './otp/mock-otp.service';
import { ExternalOtpProviderService } from './otp/external-otp.service';
import { WahaOtpService } from './otp/waha-otp.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import {
  GOOGLE_AUTH_SERVICE,
  GoogleTokenInfoService,
  MockGoogleAuthService,
} from './google/google-auth.service';

@Module({
  imports: [WhatsAppModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: OTP_SERVICE,
      inject: [WhatsAppService],
      useFactory: (whatsapp: WhatsAppService) => {
        const provider = process.env.OTP_PROVIDER || (process.env.NODE_ENV === 'production' ? 'whatsapp' : 'mock');
        if (provider === 'whatsapp') return whatsapp;
        if (provider === 'waha') return new WahaOtpService();
        if (provider === 'external') return new ExternalOtpProviderService();
        if (provider === 'mock' && process.env.NODE_ENV !== 'production') return new MockOtpService();
        throw new Error('Invalid OTP_PROVIDER; mock OTP is disabled in production.');
      },
    },
    {
      provide: GOOGLE_AUTH_SERVICE,
      useClass:
        (process.env.GOOGLE_AUTH_PROVIDER || 'mock') === 'google'
          ? GoogleTokenInfoService
          : MockGoogleAuthService,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
