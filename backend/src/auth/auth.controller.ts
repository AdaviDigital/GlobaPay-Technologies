import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { AuthenticatedUser, JwtRefreshPayload } from './interfaces/authenticated-user.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Login2faDto } from './dto/login-2fa.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2faSetupDto } from './dto/verify-2fa-setup.dto';
import { SetPinDto, ChangePinDto } from './dto/set-pin.dto';

function requestContext(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    deviceId: (req.body?.deviceId as string) ?? undefined,
    deviceName: (req.body?.deviceName as string) ?? undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---- Registration & verification -------------------------------------

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // ---- Login / session ---------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login/2fa')
  loginTwoFactor(@Body() dto: Login2faDto, @Req() req: Request) {
    return this.authService.loginWithTwoFactor(dto, requestContext(req));
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(@Req() req: Request) {
    const payload = req.user as unknown as JwtRefreshPayload;
    return this.authService.refresh(payload, requestContext(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAllDevices(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('devices')
  listDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listDevices(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('devices/:id/trust')
  trustDevice(@CurrentUser() user: AuthenticatedUser, @Param('id') deviceId: string) {
    return this.authService.trustDevice(user.id, deviceId);
  }

  // ---- Password ------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  // ---- Two-factor authentication --------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupTwoFactor(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify-setup')
  verifyTwoFactorSetup(@CurrentUser() user: AuthenticatedUser, @Body() dto: Verify2faSetupDto) {
    return this.authService.confirmTwoFactorSetup(user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() dto: Verify2faSetupDto) {
    return this.authService.disableTwoFactor(user.id, dto.code);
  }

  // ---- Transaction PIN -----------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Post('pin/set')
  setPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPinDto) {
    return this.authService.setPin(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pin/change')
  changePin(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePinDto) {
    return this.authService.changePin(user.id, dto);
  }
}
