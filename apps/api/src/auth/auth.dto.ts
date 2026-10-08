import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
  @Matches(/^\d{4,10}$/)
  code: string;

  /** Optional full name supplied at first login. */
  @IsOptional()
  @IsString()
  fullName?: string;

  /** Which app the user is signing in from — selects the role granted. */
  @IsOptional()
  @IsIn(['customer', 'admin', 'merchant', 'rider'])
  context?: 'customer' | 'admin' | 'merchant' | 'rider';
}

export class GoogleLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  idToken: string;
}

export class GoogleLoginDto extends GoogleLinkDto {
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

export class MerchantLoginDto {
  @IsString() @IsNotEmpty() identifier: string;
  @IsString() @MinLength(8) password: string;
}

export class MerchantRegistrationStartDto {
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsIn(['mobile', 'email']) channel: 'mobile' | 'email';
  @IsString() @IsNotEmpty() contact: string;
  @Matches(/^\d{5}-?\d{7}-?\d$/, { message: 'cnic must contain 13 digits' }) cnic: string;
  @IsString() @MinLength(8) password: string;
}

export class MerchantRegistrationVerifyDto {
  @IsString() @IsNotEmpty() attemptId: string;
  @Matches(/^\d{6}$/) code: string;
}

export class MerchantPasswordRequestDto {
  @IsString() @IsNotEmpty() identifier: string;
}

export class MerchantPasswordResetDto {
  @IsString() @IsNotEmpty() identifier: string;
  @Matches(/^\d{6}$/) code: string;
  @IsString() @MinLength(8) password: string;
}
