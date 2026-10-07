/**
 * Provider-agnostic OTP transport; authentication owns each challenge.
 * Switch with OTP_PROVIDER ("whatsapp" | "mock" | "waha" | "external").
 */
export interface IOtpService {
  /** Deliver the OTP code to the given phone number. Must never log the code in production. */
  sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void | { status: 'submitted'; messageId: string; requestId: string }>;
}

export const OTP_SERVICE = Symbol('OTP_SERVICE');
