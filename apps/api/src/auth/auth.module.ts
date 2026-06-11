import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OTP_SERVICE } from './otp/otp.interface';
import { MockOtpService } from './otp/mock-otp.service';
import { ExternalOtpProviderService } from './otp/external-otp.service';
import {
  GOOGLE_AUTH_SERVICE,
  GoogleTokenInfoService,
  MockGoogleAuthService,
} from './google/google-auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: OTP_SERVICE,
      useClass:
        (process.env.OTP_PROVIDER || 'mock') === 'external'
          ? ExternalOtpProviderService
          : MockOtpService,
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
