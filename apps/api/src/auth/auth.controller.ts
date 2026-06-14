import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminLoginDto, GoogleLoginDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto } from './auth.dto';
import { CurrentUser, Public, AuthUser } from '../common/decorators';

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

  @Public()
  @Post('admin-login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.email, dto.password);
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
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.userId);
  }
}
