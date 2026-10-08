import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminLoginDto, GoogleLinkDto, GoogleLoginDto, MerchantLoginDto, MerchantPasswordRequestDto, MerchantPasswordResetDto, MerchantRegistrationStartDto, MerchantRegistrationVerifyDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto } from './auth.dto';
import { CurrentUser, Public, AuthUser, AllowInactiveRider } from '../common/decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phoneNumber, dto.purpose ?? 'LOGIN');
  }

  @Public()
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phoneNumber, dto.code, dto.fullName, dto.context);
  }

  @Public()
  @Post('google-login')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken, dto.context);
  }

  @Post('google-link')
  googleLink(@CurrentUser() user: AuthUser, @Body() dto: GoogleLinkDto) {
    return this.authService.linkGoogle(user.userId, dto.idToken);
  }

  @Public()
  @Post('admin-login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  @Public()
  @Post('merchant-login')
  merchantLogin(@Body() dto: MerchantLoginDto) {
    return this.authService.merchantLogin(dto.identifier, dto.password);
  }

  @Public()
  @Post('merchant-register/start')
  merchantRegistrationStart(@Body() dto: MerchantRegistrationStartDto) {
    return this.authService.startMerchantRegistration(dto);
  }

  @Public()
  @Post('merchant-register/verify')
  merchantRegistrationVerify(@Body() dto: MerchantRegistrationVerifyDto) {
    return this.authService.verifyMerchantRegistration(dto.attemptId, dto.code);
  }

  @Public()
  @Post('merchant-password/request')
  merchantPasswordRequest(@Body() dto: MerchantPasswordRequestDto) {
    return this.authService.requestMerchantPasswordReset(dto.identifier);
  }

  @Public()
  @Post('merchant-password/reset')
  merchantPasswordReset(@Body() dto: MerchantPasswordResetDto) {
    return this.authService.resetMerchantPassword(dto.identifier, dto.code, dto.password);
  }

  @Public()
  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @AllowInactiveRider()
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.userId);
  }
}
