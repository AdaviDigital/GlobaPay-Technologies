import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Generates, stores (hashed), and dispatches a 6-digit OTP for the given purpose. */
  async issue(
    userId: string,
    purpose: OtpPurpose,
    channel: OtpChannel,
    destination: string,
  ): Promise<void> {
    const code = randomInt(100000, 999999).toString();
    const codeHash = await argon2.hash(code);
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds')!;
    const maxAttempts = this.config.get<number>('otp.maxAttempts')!;

    // Invalidate any prior outstanding codes for this purpose.
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, isUsed: false },
      data: { isUsed: true },
    });

    await this.prisma.otpCode.create({
      data: {
        userId,
        purpose,
        channel,
        destination,
        codeHash,
        maxAttempts,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    if (channel === OtpChannel.EMAIL) {
      await this.mail.sendOtpEmail(destination, code, purpose);
    }
    // SMS/WhatsApp dispatch would plug in a provider (e.g. Termii, Twilio) here —
    // intentionally left as an integration point for a later phase.
  }

  /** Verifies a submitted code against the most recent unused OTP for this purpose. */
  async verify(userId: string, purpose: OtpPurpose, submittedCode: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('No active verification code found. Please request a new one.');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('This code has expired. Please request a new one.');
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new UnauthorizedException('Too many incorrect attempts. Please request a new code.');
    }

    const isValid = await argon2.verify(otp.codeHash, submittedCode);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect verification code.');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });
  }
}
