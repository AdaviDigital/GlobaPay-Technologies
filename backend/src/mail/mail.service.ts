import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpPurpose } from '@prisma/client';

const PURPOSE_COPY: Record<OtpPurpose, { subject: string; intro: string }> = {
  EMAIL_VERIFICATION: {
    subject: 'Verify your GlobaPay email',
    intro: 'Use this code to verify your email address:',
  },
  PHONE_VERIFICATION: {
    subject: 'Verify your GlobaPay phone number',
    intro: 'Use this code to verify your phone number:',
  },
  LOGIN_2FA: {
    subject: 'Your GlobaPay sign-in code',
    intro: 'Use this code to finish signing in:',
  },
  PASSWORD_RESET: {
    subject: 'Reset your GlobaPay password',
    intro: 'Use this code to reset your password:',
  },
  PIN_RESET: {
    subject: 'Reset your GlobaPay transaction PIN',
    intro: 'Use this code to reset your transaction PIN:',
  },
  TRANSACTION_CONFIRM: {
    subject: 'Confirm your GlobaPay transaction',
    intro: 'Use this code to confirm your transaction:',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('mail.host');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.port'),
        auth: {
          user: this.config.get<string>('mail.user'),
          pass: this.config.get<string>('mail.pass'),
        },
      });
    }
  }

  async sendOtpEmail(to: string, code: string, purpose: OtpPurpose): Promise<void> {
    const copy = PURPOSE_COPY[purpose];
    const from = this.config.get<string>('mail.fromAddress');

    if (!this.transporter) {
      // No SMTP configured (e.g. local dev) — log instead of failing silently.
      this.logger.warn(`[DEV MAIL] To: ${to} | ${copy.subject} | Code: ${code}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject: copy.subject,
      text: `${copy.intro} ${code}\n\nThis code expires shortly. If you didn't request this, you can ignore this email.`,
      html: `<p>${copy.intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires shortly. If you didn't request this, you can ignore this email.</p>`,
    });
  }

  async sendPasswordResetLink(to: string, resetUrl: string): Promise<void> {
    const from = this.config.get<string>('mail.fromAddress');

    if (!this.transporter) {
      this.logger.warn(`[DEV MAIL] To: ${to} | Password reset link: ${resetUrl}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Reset your GlobaPay password',
      text: `Reset your password using this link: ${resetUrl}\n\nThis link expires shortly. If you didn't request this, you can ignore this email.`,
      html: `<p>Reset your password using the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires shortly. If you didn't request this, you can ignore this email.</p>`,
    });
  }

  async sendPriceAlertEmail(
    to: string,
    currencyCode: string,
    quoteCurrencyCode: string,
    price: string,
    direction: 'ABOVE' | 'BELOW',
  ): Promise<void> {
    const from = this.config.get<string>('mail.fromAddress');
    const subject = `${currencyCode} is now ${direction === 'ABOVE' ? 'above' : 'below'} your target price`;
    const body = `${currencyCode} is trading at ${price} ${quoteCurrencyCode}, which has crossed your alert threshold.`;

    if (!this.transporter) {
      this.logger.warn(`[DEV MAIL] To: ${to} | ${subject} | ${body}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject,
      text: body,
      html: `<p>${body}</p>`,
    });
  }
}
