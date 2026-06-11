import { Injectable, UnauthorizedException } from '@nestjs/common';

export interface GoogleProfile {
  googleId: string;
  email: string;
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
    if (!idToken.startsWith('mock:')) {
      throw new UnauthorizedException('Invalid Google token (dev mode expects "mock:<email>:<name>")');
    }
    const [, email, name] = idToken.split(':');
    if (!email || !email.includes('@')) {
      throw new UnauthorizedException('Invalid mock Google token email');
    }
    return { googleId: `mock-${email}`, email, name: name || email.split('@')[0] };
  }
}

/** Production verification against Google's tokeninfo endpoint. */
@Injectable()
export class GoogleTokenInfoService implements IGoogleAuthService {
  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) throw new UnauthorizedException('Google token verification failed');
    const data: any = await res.json();

    const expectedAud = process.env.GOOGLE_CLIENT_ID;
    if (expectedAud && data.aud !== expectedAud) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    if (!data.sub || !data.email) throw new UnauthorizedException('Google token missing claims');

    return { googleId: data.sub, email: data.email, name: data.name, picture: data.picture };
  }
}
