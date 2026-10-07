import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { IOtpService } from '../auth/otp/otp.interface';

export type WhatsAppSubmission = { status: 'submitted'; messageId: string; requestId: string };

/** Only allowlisted codes/messages leave this boundary; provider bodies may contain secrets. */
export class WhatsAppError extends HttpException {
  constructor(readonly code: string, message: string, status: number, readonly uncertain = false) {
    super({ code, message, ...(uncertain ? { submissionStatus: 'unconfirmed' } : {}) }, status);
  }
}

export function validateWhatsAppPhone(phone: string): void {
  if (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new BadRequestException('Use a phone number with country code and leading +, without spaces.');
  }
}

@Injectable()
export class WhatsAppService implements IOtpService {
  private sending = false;
  private submissions: number[] = [];

  private configuration(path: string) {
    try {
      const base = new URL(process.env.WHATSAPP_API_BASE_URL || 'http://otp.sirfbazar.com');
      const key = process.env.WHATSAPP_API_KEY;
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
          base.search || base.hash || (base.pathname !== '/' && base.pathname !== '') ||
          !key || /\s/.test(key)) throw new Error();
      return { endpoint: new URL(path, base), key };
    } catch {
      throw new WhatsAppError('WHATSAPP_CONFIGURATION', 'WhatsApp delivery is not configured.', 503);
    }
  }

  async sendOtp(phone: string, otp: string, _purpose?: string): Promise<WhatsAppSubmission> {
    validateWhatsAppPhone(phone);
    if (typeof otp !== 'string' || !/^\d{4,10}$/.test(otp)) {
      throw new BadRequestException('OTP must be a string of 4 to 10 digits.');
    }
    return this.send('/send-otp', { phone, otp });
  }

  /** Internal service method: callers must select and authorize the intended recipient. */
  async sendMessage(phone: string, message: string): Promise<WhatsAppSubmission> {
    validateWhatsAppPhone(phone);
    if (typeof message !== 'string' || !message.trim() || Array.from(message).length > 1000) {
      throw new BadRequestException('Message must contain 1 to 1,000 Unicode characters.');
    }
    return this.send('/send-message', { phone, message });
  }

  private async send(path: string, body: object): Promise<WhatsAppSubmission> {
    const { endpoint, key } = this.configuration(path);
    const now = Date.now();
    this.submissions = this.submissions.filter(time => now - time < 60_000);
    if (this.sending || this.submissions.length >= 30) {
      throw new WhatsAppError('WHATSAPP_BUSY', 'WhatsApp is busy. Wait before requesting another message.', 429);
    }
    // Fail fast rather than queue or retry. Both send endpoints share this gate.
    this.sending = true;
    this.submissions.push(now);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data: any;
      try { data = await response.json(); } catch { data = undefined; }
      const code = data?.code ?? data?.error?.code ?? data?.errorCode;
      if (code === 'SEND_UNCONFIRMED') throw this.unconfirmed();
      if (response.status === 200) {
        if (data?.status !== 'submitted' || typeof data.messageId !== 'string' ||
            !data.messageId || typeof data.requestId !== 'string' || !data.requestId) {
          throw this.unconfirmed();
        }
        return { status: 'submitted', messageId: data.messageId, requestId: data.requestId };
      }
      switch (response.status) {
        case 400: throw new WhatsAppError('WHATSAPP_INVALID_INPUT', 'WhatsApp rejected the message details.', 400);
        case 401: throw new WhatsAppError('WHATSAPP_CONFIGURATION', 'WhatsApp delivery is not configured correctly.', 503);
        case 422: throw new WhatsAppError('WHATSAPP_RECIPIENT_UNAVAILABLE', 'This number is not available on WhatsApp.', 422);
        case 429: throw new WhatsAppError('WHATSAPP_BUSY', 'WhatsApp is busy. Wait before requesting another message.', 429);
        case 503: throw new WhatsAppError('WHATSAPP_UNAVAILABLE', 'WhatsApp is currently unavailable.', 503);
        // Gateway failures can hide an accepted send. Never retry automatically.
        default: throw this.unconfirmed();
      }
    } catch (error) {
      if (error instanceof WhatsAppError) throw error;
      // Includes timeout, redirect and network errors. Never include exception details.
      throw this.unconfirmed();
    } finally {
      this.sending = false;
    }
  }

  private unconfirmed() {
    return new WhatsAppError('SEND_UNCONFIRMED',
      'Submission could not be confirmed. The message may arrive; do not immediately resend.', 502, true);
  }

  async ready(): Promise<{ ready: boolean }> {
    const { endpoint, key } = this.configuration('/ready');
    try {
      const response = await fetch(endpoint, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await response.json() as { ready?: boolean };
      if (response.status === 200 && data?.ready === true) return { ready: true };
      if (response.status === 503 && data?.ready === false) return { ready: false };
      if (response.status === 401) {
        throw new WhatsAppError('WHATSAPP_CONFIGURATION', 'WhatsApp delivery is not configured correctly.', 503);
      }
      throw new Error();
    } catch (error) {
      if (error instanceof WhatsAppError) throw error;
      throw new WhatsAppError('WHATSAPP_UNAVAILABLE', 'WhatsApp connectivity could not be verified.', 503);
    }
  }
}
