import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { OtpService } from './otp.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    ConfigModule,
  ],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
