/**
 * Provider-agnostic OTP delivery. The real SMS/OTP provider will be supplied
 * later; until then MockOtpService is used in development. Switch with the
 * OTP_PROVIDER env var ("mock" | "external").
 */
export interface IOtpService {
  /** Deliver the OTP code to the given phone number. Must never log the code in production. */
  sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void>;
}

export const OTP_SERVICE = Symbol('OTP_SERVICE');
