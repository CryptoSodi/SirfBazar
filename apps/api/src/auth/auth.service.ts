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
import { MerchantRegistrationStartDto } from './auth.dto';
import { Prisma } from '@prisma/client';
import { WhatsAppError, validateWhatsAppPhone } from '../whatsapp/whatsapp.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const positiveSetting = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

/** Existing shop riders may have been stored with a local 03 number. */
function pakistanMobileVariants(phoneNumber: string): string[] {
  const mobile = /^(?:\+?92|0)(3\d{9})$/.exec(phoneNumber)?.[1];
  if (!mobile) return [phoneNumber];
  return [...new Set([phoneNumber, `+92${mobile}`, `92${mobile}`, `0${mobile}`])];
}

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
    return positiveSetting('OTP_TTL_SECONDS', 300);
  }
  private get otpMaxAttempts() {
    return positiveSetting('OTP_MAX_ATTEMPTS', 5);
  }
  private get otpResendCooldownSeconds() {
    return positiveSetting('OTP_RESEND_COOLDOWN_SECONDS', 60);
  }
  private get otpMaxRequestsPerHour() {
    return positiveSetting('OTP_MAX_REQUESTS_PER_HOUR', 5);
  }
  private get isMockOtp() {
    return process.env.NODE_ENV !== 'production' && (process.env.OTP_PROVIDER || 'mock') === 'mock';
  }
  private get isWhatsAppOtp() {
    return ['waha', 'whatsapp'].includes(process.env.OTP_PROVIDER || (process.env.NODE_ENV === 'production' ? 'whatsapp' : 'mock'));
  }

  private async invalidateOtp(id: string) {
    await this.prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  private async enforceOtpRequestLimit(identifier: string, purpose: string, db: Prisma.TransactionClient = this.prisma) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recent, requestsInLastHour] = await Promise.all([
      db.otpCode.findFirst({
        where: { phoneNumber: identifier },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      db.otpCode.count({
        where: { phoneNumber: identifier, createdAt: { gte: since } },
      }),
    ]);
    if (recent) {
      const ageSeconds = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (ageSeconds < this.otpResendCooldownSeconds) {
        throw new HttpException(
          `Please wait ${Math.ceil(this.otpResendCooldownSeconds - ageSeconds)}s before requesting a new code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    if (requestsInLastHour >= this.otpMaxRequestsPerHour) {
      throw new HttpException('Too many code requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async createOtp(identifier: string, purpose: string, code: string) {
    // Salted, deliberately slow hashes protect short codes at rest. Never persist plaintext.
    const codeHash = await bcrypt.hash(code, 12);
    return this.prisma.$transaction(async db => {
      // Shared across API processes: concurrent resends cannot bypass recipient limits.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${identifier}`}))`;
      await this.enforceOtpRequestLimit(identifier, purpose, db);
      await db.otpCode.updateMany({
        where: { phoneNumber: identifier, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return db.otpCode.create({ data: {
        phoneNumber: identifier, purpose, codeHash,
        expiresAt: new Date(Date.now() + this.otpTtlSeconds * 1000),
      } });
    });
  }

  private async deliverOtp(id: string, identifier: string, code: string, purpose: string) {
    try {
      await this.otpService.sendOtp(identifier, code, purpose);
      return this.isMockOtp ? 'test' as const : 'submitted' as const;
    } catch (error) {
      // It may have arrived. Keep the challenge valid and preserve the resend cooldown.
      if (error instanceof WhatsAppError && error.uncertain) return 'unconfirmed' as const;
      await this.invalidateOtp(id);
      throw error;
    }
  }

  private async consumeOtp(otp: { id: string; codeHash: string }, code: string) {
    const invalid = () => new UnauthorizedException('Code is invalid, expired, or has too many failed attempts.');
    // Reserve an attempt before comparing, including concurrent verification requests.
    const reserved = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: this.otpMaxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count !== 1) throw invalid();
    const valid = (this.isMockOtp && code === '123456') || await bcrypt.compare(code, otp.codeHash);
    if (!valid) throw invalid();
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw invalid();
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  async sendOtp(phoneNumber: string, purpose = 'LOGIN') {
    phoneNumber = this.normalizePhone(phoneNumber);
    const code = generateNumericCode(6);
    const attempt = await this.createOtp(phoneNumber, purpose, code);
    const status = await this.deliverOtp(attempt.id, phoneNumber, code, purpose);
    return { sent: status !== 'unconfirmed', status, expiresInSeconds: this.otpTtlSeconds,
      ...(status === 'unconfirmed' ? { message: 'Submission is unconfirmed. If a code arrives, use it; wait before resending.' } : {}) };
  }

  async verifyOtp(phoneNumber: string, code: string, fullName?: string, context: AuthContext = 'customer') {
    phoneNumber = this.normalizePhone(phoneNumber);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phoneNumber, purpose: 'LOGIN', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('No pending code for this number — request a new one');
    if (otp.expiresAt < new Date()) throw new UnauthorizedException('Code expired — request a new one');
    if (otp.attempts >= this.otpMaxAttempts) {
      throw new UnauthorizedException('Too many failed attempts — request a new code');
    }

    await this.consumeOtp(otp, code);

    let user = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (context === 'rider') {
      // Prefer the rider already linked to this verified mobile number over a
      // base account accidentally created under its alternate phone format.
      const riders = await this.prisma.rider.findMany({
        where: { user: { is: { phoneNumber: { in: pakistanMobileVariants(phoneNumber) } } } },
        select: { user: true },
      });
      if (riders.length > 1) {
        throw new UnauthorizedException('Multiple rider accounts use this number. Contact your shop.');
      }
      if (riders.length === 1) user = riders[0].user;
    }
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

  private normalizePhone(value: string) {
    if (!/^[+\d\s()-]+$/.test(value)) throw new BadRequestException('Invalid phone number.');
    const digits = value.replace(/\D/g, '');
    const phone = value.trim().startsWith('+') || digits.startsWith('92') ? `+${digits}`
      : digits.startsWith('0') ? `+92${digits.slice(1)}` : `+92${digits}`;
    validateWhatsAppPhone(phone);
    return phone;
  }

  private normalizeIdentifier(value: string) {
    const clean = value.trim().toLowerCase();
    return clean.includes('@') ? clean : this.normalizePhone(clean);
  }

  private async merchantUserByIdentifier(identifier: string) {
    const clean = this.normalizeIdentifier(identifier);
    return this.prisma.user.findFirst({
      where: clean.includes('@') ? { email: clean } : { phoneNumber: clean },
      include: { merchant: { select: { id: true } }, staffOf: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });
  }

  async merchantLogin(identifier: string, password: string) {
    const user = await this.merchantUserByIdentifier(identifier);
    if (!user || !user.passwordHash || (!user.merchant && !user.staffOf.length)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account is suspended');
    return this.issueTokens(user.id, user.merchant ? UserRole.MERCHANT_OWNER : UserRole.MERCHANT_STAFF);
  }

  async startMerchantRegistration(dto: MerchantRegistrationStartDto) {
    const identifier = this.normalizeIdentifier(dto.contact);
    if (!this.isMockOtp && (dto.channel !== 'mobile' || identifier.includes('@'))) {
      throw new BadRequestException('Verification requires a mobile number. Email delivery is not configured.');
    }
    await this.enforceOtpRequestLimit(identifier, 'MERCHANT_REGISTRATION');
    const cnic = dto.cnic.replace(/\D/g, '');
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ cnic }, identifier.includes('@') ? { email: identifier } : { phoneNumber: identifier }] },
      include: { merchant: { select: { id: true } } },
    });
    if (existing?.merchant) throw new BadRequestException('A merchant account already exists for these details. Sign in instead.');
    if (existing && existing.cnic && existing.cnic !== cnic) throw new BadRequestException('These registration details are already in use.');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const data = {
      fullName: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
      cnic,
      passwordHash,
      ...(identifier.includes('@') ? { email: identifier } : { phoneNumber: identifier }),
    };
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data })
      : await this.prisma.user.create({ data: { ...data, role: UserRole.CUSTOMER } });
    const code = this.isMockOtp ? '123456' : generateNumericCode(6);
    const attempt = await this.createOtp(identifier, 'MERCHANT_REGISTRATION', code);
    const status = this.isMockOtp ? 'test' : await this.deliverOtp(attempt.id, identifier, code, 'MERCHANT_REGISTRATION');
    return {
      attemptId: attempt.id,
      status,
      message: status === 'unconfirmed'
        ? 'Submission is unconfirmed. If a code arrives, use it; wait before resending.'
        : this.isMockOtp
        ? 'Local test verification ready.'
        : this.isWhatsAppOtp
          ? 'Verification code submitted to WhatsApp.'
          : 'Verification code sent.',
    };
  }

  async verifyMerchantRegistration(attemptId: string, code: string) {
    const otp = await this.prisma.otpCode.findUnique({ where: { id: attemptId } });
    if (!otp || otp.purpose !== 'MERCHANT_REGISTRATION' || otp.consumedAt) throw new UnauthorizedException('Registration code is no longer valid.');
    if (otp.expiresAt < new Date()) throw new UnauthorizedException('Registration code has expired.');
    if (otp.attempts >= this.otpMaxAttempts) throw new UnauthorizedException('Too many failed attempts.');
    await this.consumeOtp(otp, code);
    const user = await this.merchantUserByIdentifier(otp.phoneNumber);
    if (!user) throw new UnauthorizedException('Registration account was not found.');
    await this.prisma.user.update({ where: { id: user.id }, data: otp.phoneNumber.includes('@') ? { isEmailVerified: true } : { isPhoneVerified: true } });
    return this.issueTokens(user.id, UserRole.CUSTOMER);
  }

  async requestMerchantPasswordReset(identifier: string) {
    const clean = this.normalizeIdentifier(identifier);
    if (!this.isMockOtp && clean.includes('@')) {
      throw new BadRequestException('Use your registered mobile number for password recovery.');
    }
    await this.enforceOtpRequestLimit(clean, 'MERCHANT_PASSWORD_RESET');
    const user = await this.merchantUserByIdentifier(clean);
    if (user) {
      const code = this.isMockOtp ? '123456' : generateNumericCode(6);
      const attempt = await this.createOtp(clean, 'MERCHANT_PASSWORD_RESET', code);
      if (!this.isMockOtp && !clean.includes('@')) {
        await this.deliverOtp(attempt.id, clean, code, 'MERCHANT_PASSWORD_RESET');
      }
    }
    return { message: this.isMockOtp ? 'Local test recovery code ready.' : 'If this contact is registered, a code was requested. Submission does not confirm delivery; wait before resending.' };
  }

  async resetMerchantPassword(identifier: string, code: string, password: string) {
    const clean = this.normalizeIdentifier(identifier);
    const user = await this.merchantUserByIdentifier(clean);
    const otp = await this.prisma.otpCode.findFirst({ where: { phoneNumber: clean, purpose: 'MERCHANT_PASSWORD_RESET', consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!user || !otp || otp.expiresAt < new Date() || otp.attempts >= this.otpMaxAttempts) throw new UnauthorizedException('Recovery code is invalid or expired.');
    await this.consumeOtp(otp, code);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
      this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true };
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
        role,
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
    // A user can be a customer and merchant/rider at once. Rotating a refresh
    // token must retain the role selected at login, not the user's base role.
    // Tokens issued before the role column existed keep the legacy fallback;
    // those clients can re-authenticate to establish an app-scoped session.
    const requestedRole = (stored.role ?? user.role) as UserRole;
    let activeRole: UserRole;
    if (requestedRole === UserRole.CUSTOMER) {
      activeRole = await this.resolveContextRole(user.id, 'customer');
    } else if (requestedRole === UserRole.MERCHANT_OWNER || requestedRole === UserRole.MERCHANT_STAFF) {
      activeRole = await this.resolveContextRole(user.id, 'merchant');
    } else if (requestedRole === UserRole.RIDER) {
      activeRole = await this.resolveContextRole(user.id, 'rider');
      if (activeRole !== UserRole.RIDER) throw new UnauthorizedException('Rider access is no longer available');
    } else if (ADMIN_ROLES.includes(requestedRole)) {
      activeRole = await this.resolveContextRole(user.id, 'admin');
    } else {
      throw new UnauthorizedException('Invalid session role');
    }
    return this.issueTokens(user.id, activeRole);
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
    const { passwordHash: _ph, cnic: _cnic, ...safe } = user;
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
