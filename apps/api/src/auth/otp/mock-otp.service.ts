import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { IOtpService } from './otp.interface';

/**
 * Development-only OTP delivery: no outbound messages and no credential logging.
 * In mock mode the master code "123456" is also accepted by AuthService,
 * so automated tests do not need to scrape logs.
 */
@Injectable()
export class MockOtpService implements IOtpService {
  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('Mock OTP is disabled in production.');
  }
}
