import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export class SendOtpDto {
  @Matches(PHONE_REGEX, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber: string;

  @IsOptional()
  @IsIn(['LOGIN', 'DELIVERY'])
  purpose?: string;
}

export class VerifyOtpDto {
  @Matches(PHONE_REGEX, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber: string;

  @IsString()
  @MinLength(4)
  code: string;

  /** Optional full name supplied at first login. */
  @IsOptional()
  @IsString()
  fullName?: string;
}

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  /** Which app the user is signing in from — gates role access. Default customer. */
  @IsOptional()
  @IsIn(['customer', 'admin', 'merchant', 'rider'])
  context?: 'customer' | 'admin' | 'merchant' | 'rider';
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
