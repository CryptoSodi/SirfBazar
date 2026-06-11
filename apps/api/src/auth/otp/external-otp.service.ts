import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { IOtpService } from './otp.interface';

/**
 * Placeholder for the real OTP provider (to be supplied later).
 * Reads OTP_PROVIDER_BASE_URL / OTP_PROVIDER_API_KEY from the environment and
 * POSTs { phoneNumber, message }. Adjust the payload to the provider's contract
 * once it is known — nothing else in the system needs to change.
 */
@Injectable()
export class ExternalOtpProviderService implements IOtpService {
  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    const baseUrl = process.env.OTP_PROVIDER_BASE_URL;
    const apiKey = process.env.OTP_PROVIDER_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException('OTP provider is not configured');
    }

    const res = await fetch(`${baseUrl}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        phoneNumber,
        message: `Your SirfBazar ${purpose.toLowerCase()} code is ${code}. It expires in 5 minutes.`,
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`OTP provider returned ${res.status}`);
    }
  }
}
