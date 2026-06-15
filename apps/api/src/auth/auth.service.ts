import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ROLES, UserRole } from '../common/constants';
import { generateNumericCode, generateToken } from '../common/utils/ids';
import { IOtpService, OTP_SERVICE } from './otp/otp.interface';
import { GOOGLE_AUTH_SERVICE, IGoogleAuthService } from './google/google-auth.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Which app the user signed in from — selects which "hat" (role) the token grants. */
type AuthContext = 'customer' | 'admin' | 'merchant' | 'rider';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(OTP_SERVICE) private readonly otpService: IOtpService,
    @Inject(GOOGLE_AUTH_SERVICE) private readonly googleAuth: IGoogleAuthService,
  ) {}

  private get otpTtlSeconds() {
    return Number(process.env.OTP_TTL_SECONDS || 300);
  }
  private get otpMaxAttempts() {
    return Number(process.env.OTP_MAX_ATTEMPTS || 5);
  }
  private get otpResendCooldownSeconds() {
    return Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
  }
  private get isMockOtp() {
    return (process.env.OTP_PROVIDER || 'mock') === 'mock';
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  async sendOtp(phoneNumber: string, purpose = 'LOGIN') {
    const recent = await this.prisma.otpCode.findFirst({
      where: { phoneNumber, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const ageSeconds = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (ageSeconds < this.otpResendCooldownSeconds) {
        throw new HttpException(
          `Please wait ${Math.ceil(this.otpResendCooldownSeconds - ageSeconds)}s before requesting a new code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = generateNumericCode(6);
    await this.prisma.otpCode.create({
      data: {
        phoneNumber,
        purpose,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + this.otpTtlSeconds * 1000),
      },
    });
    await this.otpService.sendOtp(phoneNumber, code, purpose);
    return { sent: true, expiresInSeconds: this.otpTtlSeconds };
  }

  async verifyOtp(phoneNumber: string, code: string, fullName?: string, context: AuthContext = 'customer') {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phoneNumber, purpose: 'LOGIN', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('No pending code for this number — request a new one');
    if (otp.expiresAt < new Date()) throw new UnauthorizedException('Code expired — request a new one');
    if (otp.attempts >= this.otpMaxAttempts) {
      throw new UnauthorizedException('Too many failed attempts — request a new code');
    }

    const masterCodeOk = this.isMockOtp && code === '123456';
    if (!masterCodeOk && otp.codeHash !== sha256(code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) {
      // Customer + rider self-onboarding create a base account; merchant/admin must pre-exist.
      if (context !== 'customer' && context !== 'rider') {
        throw new UnauthorizedException('No account exists for this number.');
      }
      user = await this.prisma.user.create({
        data: {
          phoneNumber,
          fullName: fullName || null,
          role: UserRole.CUSTOMER,
          isPhoneVerified: true,
        },
      });
    } else if (!user.isPhoneVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true, ...(fullName ? { fullName } : {}) },
      });
    }
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account is suspended');

    const role = await this.resolveContextRole(user.id, context);
    return this.issueTokens(user.id, role);
  }

  // ── Google ────────────────────────────────────────────────────────────────

  async googleLogin(idToken: string, context: AuthContext = 'customer') {
    const profile = await this.googleAuth.verifyIdToken(idToken);

    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.googleId, isEmailVerified: true },
        });
      } else if (context === 'customer') {
        // Consumers self-register on first Google sign-in; staff/merchants do not.
        user = await this.prisma.user.create({
          data: {
            googleId: profile.googleId,
            email: profile.email,
            fullName: profile.name || null,
            profileImageUrl: profile.picture || null,
            role: UserRole.CUSTOMER,
            isEmailVerified: true,
          },
        });
      } else {
        const what =
          context === 'admin' ? 'an authorised admin' : context === 'rider' ? 'a registered rider' : 'a registered merchant';
        throw new UnauthorizedException(`This Google account is not ${what}.`);
      }
    }

    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account is suspended');

    const role = await this.resolveContextRole(user.id, context);
    return this.issueTokens(user.id, role);
  }

  // ── Admin email/password ──────────────────────────────────────────────────

  async adminLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const adminRoles: string[] = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.SUPPORT_AGENT,
      UserRole.FINANCE_ADMIN,
    ];
    if (!user || !user.passwordHash || !adminRoles.includes(user.role)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account is suspended');
    return this.issueTokens(user.id, user.role as UserRole);
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  async issueTokens(userId: string, role: UserRole) {
    const accessToken = await this.jwtService.signAsync({ sub: userId, role });
    const refreshToken = generateToken(32);
    const refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlDays * 86400_000),
      },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

    const user = await this.getMe(userId);
    return { accessToken, refreshToken, user };
  }

  async refreshTokens(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status === 'SUSPENDED') throw new UnauthorizedException('Invalid refresh token');

    // Rotate: revoke the old token, issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user.id, user.role as UserRole);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: true,
        merchant: { select: { id: true, shopName: true, approvalStatus: true, isOnline: true } },
        rider: { select: { id: true, merchantId: true, isActive: true, isOnline: true } },
        staffOf: { select: { merchantId: true, roleName: true, permissions: true, status: true } },
      },
    });
    if (!user) throw new BadRequestException('User not found');
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  /** Customers are created lazily on first customer-context login. */
  private async ensureCustomerRecord(userId: string) {
    await this.prisma.customer.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /**
   * Pick the role to mint into the token for the app the user signed in from.
   * Capability = the linked record exists, so ONE account can be a customer, a
   * merchant, and a rider at once — the active role is chosen per app at login.
   */
  private async resolveContextRole(userId: string, context: AuthContext): Promise<UserRole> {
    if (context === 'customer') {
      await this.ensureCustomerRecord(userId);
      return UserRole.CUSTOMER;
    }
    if (context === 'merchant') {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId }, select: { id: true } });
      if (merchant) return UserRole.MERCHANT_OWNER;
      const staff = await this.prisma.merchantStaff.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (staff) return UserRole.MERCHANT_STAFF;
      throw new UnauthorizedException('This account is not a merchant — onboard your shop first.');
    }
    if (context === 'rider') {
      const rider = await this.prisma.rider.findUnique({ where: { userId }, select: { id: true } });
      if (rider) return UserRole.RIDER;
      // Not a rider yet — hand back a base customer identity so the account can
      // self-onboard (browse shops + apply); /rider/apply then mints a RIDER token.
      await this.ensureCustomerRecord(userId);
      return UserRole.CUSTOMER;
    }
    // admin
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (u && ADMIN_ROLES.includes(u.role as UserRole)) return u.role as UserRole;
    throw new UnauthorizedException('This account does not have admin access.');
  }
}
