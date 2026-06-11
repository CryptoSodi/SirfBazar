import { Injectable, Logger } from '@nestjs/common';
import { IOtpService } from './otp.interface';

/**
 * Development-only OTP delivery: prints the code to the server console.
 * In mock mode the master code "123456" is also accepted by AuthService,
 * so automated tests do not need to scrape logs.
 */
@Injectable()
export class MockOtpService implements IOtpService {
  private readonly logger = new Logger('MockOtp');

  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    this.logger.log(`[DEV ONLY] OTP for ${phoneNumber} (${purpose}): ${code}`);
  }
}
