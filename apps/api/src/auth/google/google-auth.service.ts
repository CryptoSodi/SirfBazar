import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailAuthoritative: boolean;
  name?: string;
  picture?: string;
}

export interface IGoogleAuthService {
  verifyIdToken(idToken: string): Promise<GoogleProfile>;
}

export const GOOGLE_AUTH_SERVICE = Symbol('GOOGLE_AUTH_SERVICE');

/** Development mock: accepts tokens of the form "mock:<email>[:<name>]". */
@Injectable()
export class MockGoogleAuthService implements IGoogleAuthService {
  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Mock Google login is disabled');
    if (!idToken.startsWith('mock:')) {
      throw new UnauthorizedException('Invalid Google token (dev mode expects "mock:<email>:<name>")');
    }
    const [, email, name] = idToken.split(':');
    if (!email || !email.includes('@')) {
      throw new UnauthorizedException('Invalid mock Google token email');
    }
    return { googleId: `mock-${email}`, email: email.toLowerCase(), emailAuthoritative: true, name: name || email.split('@')[0] };
  }
}

@Injectable()
export class GoogleIdTokenService implements IGoogleAuthService {
  private readonly client: OAuth2Client;
  private readonly audience: string;

  constructor(audience = process.env.GOOGLE_CLIENT_ID || '', client?: OAuth2Client) {
    this.audience = audience.trim();
    if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(this.audience)) {
      throw new Error('GOOGLE_CLIENT_ID must be the Web OAuth client ID used by the SirfBazar clients.');
    }
    this.client = client || new OAuth2Client();
    // Bound certificate fetches; Google's SDK caches keys. Never send ID tokens in URLs.
    this.client.transporter.interceptors.request.add({ resolved: async options => {
      options.timeout = 5000;
      options.retry = false;
      return options;
    } });
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    if (!idToken || idToken.length > 10000 || idToken.split('.').length !== 3) {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    let payload;
    try {
      // Signature, expiration, issuer and mandatory audience are verified by Google's SDK.
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audience });
      payload = ticket.getPayload();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Failed to retrieve verification certificates:')) {
        throw new ServiceUnavailableException('Google sign-in is temporarily unavailable. Please try again.');
      }
      // SDK diagnostics can contain the JWT payload; never return or log them.
      throw new UnauthorizedException('Invalid or expired Google ID token');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google must verify your email address before sign-in');
    }
    const email = payload.email.trim().toLowerCase();
    return {
      googleId: payload.sub, email,
      // Third-party mailboxes can change owners independently of the Google identity.
      emailAuthoritative: email.endsWith('@gmail.com') || Boolean(payload.hd),
      name: payload.name, picture: payload.picture,
    };
  }
}

export function createGoogleAuthService(): IGoogleAuthService {
  const provider = process.env.GOOGLE_AUTH_PROVIDER || 'google';
  if (provider === 'google') return new GoogleIdTokenService();
  if (provider === 'mock' && process.env.NODE_ENV !== 'production') return new MockGoogleAuthService();
  throw new Error('Invalid GOOGLE_AUTH_PROVIDER; mock Google login is disabled in production.');
}
