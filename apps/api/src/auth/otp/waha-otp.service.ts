import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { IOtpService } from './otp.interface';

const PAKISTAN_MOBILE = /^\+923\d{9}$/;

function canonicalPakistanMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  const canonical = digits.startsWith('92')
    ? `+${digits}`
    : digits.startsWith('0')
      ? `+92${digits.slice(1)}`
      : `+92${digits}`;
  return PAKISTAN_MOBILE.test(canonical) ? canonical : null;
}

function otpLabel(purpose: string) {
  switch (purpose) {
    case 'MERCHANT_REGISTRATION': return 'merchant signup';
    case 'MERCHANT_PASSWORD_RESET': return 'password reset';
    case 'LOGIN': return 'sign-in';
    default: return 'verification';
  }
}

/**
 * Text-only WAHA adapter. The API remains responsible for generating, hashing,
 * expiring and consuming OTP challenges; WAHA only transports the message.
 */
@Injectable()
export class WahaOtpService implements IOtpService {
  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    const baseUrl = process.env.WAHA_BASE_URL;
    const apiKey = process.env.WAHA_API_KEY;
    const session = process.env.WAHA_SESSION || 'default';
    const phone = canonicalPakistanMobile(phoneNumber);
    const allowedRecipients = new Set(
      (process.env.WAHA_TEST_RECIPIENTS || '')
        .split(',')
        .map((value) => canonicalPakistanMobile(value.trim()))
        .filter((value): value is string => Boolean(value)),
    );

    let endpoint: URL;
    try {
      endpoint = new URL('/api/sendText', baseUrl);
    } catch {
      throw new ServiceUnavailableException('WhatsApp OTP delivery is not configured');
    }

    const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost']);
    if (
      !baseUrl || !apiKey || apiKey.length < 32 || /\s/.test(apiKey) ||
      !phone || !/^\d{6}$/.test(code) || !/^[a-zA-Z0-9_-]{1,64}$/.test(session) ||
      !['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
      (!loopbackHosts.has(endpoint.hostname) && process.env.WAHA_ALLOW_REMOTE !== 'true') ||
      (allowedRecipients.size > 0 && !allowedRecipients.has(phone)) ||
      (process.env.NODE_ENV !== 'production' && allowedRecipients.size === 0)
    ) {
      throw new ServiceUnavailableException('WhatsApp OTP delivery is not configured for this number');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          session,
          chatId: `${phone.slice(1)}@c.us`,
          text: `Your SirfBazar ${otpLabel(purpose)} code is ${code}. It expires in 5 minutes. Do not share this code.`,
          linkPreview: false,
          linkPreviewHighQuality: false,
        }),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error('Provider rejected the message');
    } catch {
      // Never expose the OTP, recipient, API key or provider response body.
      throw new ServiceUnavailableException('WhatsApp OTP delivery is unavailable');
    }
  }
}
