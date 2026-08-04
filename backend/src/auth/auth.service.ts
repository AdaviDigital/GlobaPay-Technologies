import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { OtpChannel, OtpPurpose, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { MailService } from '../mail/mail.service';
import { WalletsService } from '../wallets/wallets.service';
import { RoleName } from '../common/enums/role.enum';
import { maskEmail, maskPhone } from '../common/utils/mask.util';
import { RegisterDto } from './dto/register.dto';
import { AuditLogService } from '../admin/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { Login2faDto } from './dto/login-2fa.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPinDto, ChangePinDto } from './dto/set-pin.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
}

const LOGIN_TOKEN_TTL_SECONDS = 5 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly wallets: WalletsService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either an email or a phone number is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(
          Boolean,
        ) as Array<{ email: string } | { phone: string }>,
      },
    });

    if (existing) {
      throw new ConflictException('An account with this email or phone number already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const roleName = dto.accountType ?? RoleName.INDIVIDUAL;

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new BadRequestException('Invalid account type');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
          country: dto.country ?? 'NG',
          status: UserStatus.PENDING_VERIFICATION,
          roles: { create: [{ roleId: role.id }] },
        },
      });

      await this.wallets.provisionDefaultWallets(created.id, tx);

      return created;
    });

    if (dto.email) {
      await this.otp.issue(user.id, OtpPurpose.EMAIL_VERIFICATION, OtpChannel.EMAIL, dto.email);
    }
    // Phone OTP dispatch (SMS/WhatsApp) plugs in a provider in a later phase.

    return {
      userId: user.id,
      verificationChannel: dto.email ? 'email' : 'phone',
      destination: dto.email ? maskEmail(dto.email) : maskPhone(dto.phone!),
      message: 'Registration successful. Please verify your account with the code we sent you.',
    };
  }

  // ---------------------------------------------------------------------
  // OTP verification (email/phone verification, password reset, PIN reset)
  // ---------------------------------------------------------------------

  async verifyOtp(dto: VerifyOtpDto) {
    await this.otp.verify(dto.userId, dto.purpose, dto.code);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: dto.userId } });

    if (dto.purpose === OtpPurpose.EMAIL_VERIFICATION) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          status: user.status === UserStatus.PENDING_VERIFICATION ? UserStatus.ACTIVE : user.status,
        },
      });
    }

    if (dto.purpose === OtpPurpose.PHONE_VERIFICATION) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerifiedAt: new Date(),
          status: user.status === UserStatus.PENDING_VERIFICATION ? UserStatus.ACTIVE : user.status,
        },
      });
    }

    return { verified: true, purpose: dto.purpose };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: dto.userId } });

    if (dto.purpose === OtpPurpose.EMAIL_VERIFICATION || dto.purpose === OtpPurpose.PASSWORD_RESET) {
      if (!user.email) throw new BadRequestException('No email on file for this account');
      await this.otp.issue(user.id, dto.purpose, OtpChannel.EMAIL, user.email);
      return { destination: maskEmail(user.email) };
    }

    if (!user.phone) throw new BadRequestException('No phone number on file for this account');
    await this.otp.issue(user.id, dto.purpose, OtpChannel.SMS, user.phone);
    return { destination: maskPhone(user.phone) };
  }

  // ---------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------

  async login(dto: LoginDto, ctx: RequestContext) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either an email or a phone number is required');
    }

    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException('This account is not active. Please contact support.');
    }

    if (user.twoFactorEnabled) {
      const loginToken = this.jwt.sign(
        { sub: user.id, stage: 'awaiting_2fa' },
        {
          secret: this.config.get<string>('jwt.accessSecret'),
          expiresIn: LOGIN_TOKEN_TTL_SECONDS,
        },
      );

      return {
        requires2fa: true,
        userId: user.id,
        loginToken,
      };
    }

    return this.issueSessionTokens(user.id, ctx);
  }

  async loginWithTwoFactor(dto: Login2faDto, ctx: RequestContext) {
    let payload: { sub: string; stage: string };
    try {
      payload = this.jwt.verify(dto.loginToken, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Login session expired. Please sign in again.');
    }

    if (payload.stage !== 'awaiting_2fa' || payload.sub !== dto.userId) {
      throw new UnauthorizedException('Invalid login session');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: dto.userId } });

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not configured for this account');
    }

    const isValid = authenticator.check(dto.code, user.twoFactorSecret);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect authentication code');
    }

    return this.issueSessionTokens(user.id, ctx);
  }

  // ---------------------------------------------------------------------
  // Session / token issuance
  // ---------------------------------------------------------------------

  private async issueSessionTokens(userId: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const roleNames = user.roles.map((ur) => ur.role.name);
    const permissionNames = Array.from(
      new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name))),
    );

    let deviceRecordId: string | undefined;
    if (ctx.deviceId) {
      const device = await this.prisma.device.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: ctx.deviceId } },
        update: { lastSeenAt: new Date(), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        create: {
          userId: user.id,
          deviceId: ctx.deviceId,
          name: ctx.deviceName,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
      deviceRecordId = device.id;
    }

    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn')!;
    const refreshExpiresAt = new Date(Date.now() + this.parseDurationMs(refreshExpiresIn));
    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await argon2.hash(rawRefreshToken);

    const refreshTokenRow = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: deviceRecordId,
        refreshTokenId: refreshTokenRow.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        expiresAt: refreshExpiresAt,
      },
    });

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: roleNames,
        permissions: permissionNames,
        sessionId: session.id,
      },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, sessionId: session.id, tokenId: refreshTokenRow.id },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    this.auditLog.record({
      userId: user.id,
      action: 'auth.session_issued',
      entity: 'Session',
      entityId: session.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: roleNames,
        kycTier: user.kycTier,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async refresh(payload: { sub: string; sessionId: string; tokenId: string }, ctx: RequestContext) {
    const tokenRow = await this.prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });

    if (!tokenRow || tokenRow.isRevoked || tokenRow.expiresAt < new Date() || tokenRow.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    // Rotate: revoke the used token and its session, then issue a fresh pair.
    await this.prisma.refreshToken.update({ where: { id: tokenRow.id }, data: { isRevoked: true } });
    await this.prisma.session.updateMany({ where: { refreshTokenId: tokenRow.id }, data: { isRevoked: true } });

    return this.issueSessionTokens(payload.sub, ctx);
  }

  async logout(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return { loggedOut: true };

    await this.prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
    if (session.refreshTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: session.refreshTokenId },
        data: { isRevoked: true },
      });
    }
    return { loggedOut: true };
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    await this.prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    this.auditLog.record({ userId, action: 'auth.logout_all_devices' });
    return { loggedOut: true };
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------
  // Password reset / change
  // ---------------------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always respond the same way, whether or not the account exists, to avoid
    // leaking which emails are registered.
    if (!user) {
      return { message: 'If an account exists for this email, a reset link has been sent.' };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetUrl = `${this.config.get<string>('frontendUrl')}/reset-password?token=${rawToken}&uid=${user.id}`;
    await this.mail.sendPasswordResetLink(user.email!, resetUrl);

    return { message: 'If an account exists for this email, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // token format from the client is "<rawToken>" — the uid is looked up via
    // any non-expired, unused token whose hash matches (constant-time via argon2.verify).
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.tokenHash, dto.token)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const newHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: matched.userId }, data: { passwordHash: newHash } }),
      this.prisma.passwordResetToken.update({ where: { id: matched.id }, data: { isUsed: true } }),
      this.prisma.session.updateMany({ where: { userId: matched.userId }, data: { isRevoked: true } }),
      this.prisma.refreshToken.updateMany({ where: { userId: matched.userId }, data: { isRevoked: true } }),
    ]);

    return { message: 'Your password has been reset. Please sign in again.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    this.auditLog.record({ userId, action: 'auth.password_changed' });
    return { message: 'Password updated successfully' };
  }

  // ---------------------------------------------------------------------
  // Two-factor authentication (TOTP)
  // ---------------------------------------------------------------------

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email ?? user.phone ?? user.id, 'GlobaPay', secret);

    // Stored immediately so verify-setup can check it, but twoFactorEnabled
    // stays false until the user proves possession with a valid code.
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
    return { secret, otpauthUrl: otpauth, qrCodeDataUrl };
  }

  async confirmTwoFactorSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Start two-factor setup before confirming a code');
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect authentication code');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { twoFactorEnabled: true };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect authentication code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { twoFactorEnabled: false };
  }

  // ---------------------------------------------------------------------
  // Transaction PIN
  // ---------------------------------------------------------------------

  async setPin(userId: string, dto: SetPinDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.pinHash) {
      throw new ConflictException('A PIN is already set. Use the change-PIN endpoint instead.');
    }
    const pinHash = await argon2.hash(dto.pin);
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
    return { message: 'Transaction PIN set successfully' };
  }

  async changePin(userId: string, dto: ChangePinDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.pinHash) {
      throw new BadRequestException('No PIN is set for this account yet');
    }
    const valid = await argon2.verify(user.pinHash, dto.currentPin);
    if (!valid) {
      throw new UnauthorizedException('Current PIN is incorrect');
    }
    const pinHash = await argon2.hash(dto.pin);
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
    return { message: 'Transaction PIN updated successfully' };
  }

  /**
   * Shared by other modules (e.g. transfers) that need to confirm a sensitive
   * action with the account's transaction PIN before proceeding.
   */
  async verifyPin(userId: string, pin: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.pinHash) {
      throw new BadRequestException('Set a transaction PIN before making transfers');
    }
    const valid = await argon2.verify(user.pinHash, pin);
    if (!valid) {
      throw new UnauthorizedException('Incorrect transaction PIN');
    }
  }

  // ---------------------------------------------------------------------
  // Devices
  // ---------------------------------------------------------------------

  async trustDevice(userId: string, deviceRecordId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceRecordId, userId } });
    if (!device) throw new BadRequestException('Device not found');
    await this.prisma.device.update({ where: { id: device.id }, data: { isTrusted: true } });
    return { trusted: true };
  }

  async listDevices(userId: string) {
    return this.prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' } });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /** Parses simple duration strings like "15m", "30d", "1h" into milliseconds. */
  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
    return value * unitMs;
  }
}
