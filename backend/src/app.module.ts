import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import Redis from 'ioredis';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { OtpModule } from './otp/otp.module';
import { MailModule } from './mail/mail.module';
import { FxModule } from './fx/fx.module';
import { FeesModule } from './fees/fees.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { TransfersModule } from './transfers/transfers.module';
import { CryptoModule } from './crypto/crypto.module';
import { KycModule } from './kyc/kyc.module';
import { P2pModule } from './p2p/p2p.module';
import { CardsModule } from './cards/cards.module';
import { MerchantModule } from './merchant/merchant.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    // Registered once, here, for the whole app — @Cron() decorators anywhere
    // (transfers scheduler, crypto price ticks, order/alert checks, P2P
    // auto-refunds) all rely on this single registration rather than each
    // feature module calling forRoot() itself.
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // BullMQ requires maxRetriesPerRequest: null for its blocking connections.
        connection: new Redis(config.get<string>('redis.url')!, { maxRetriesPerRequest: null }),
      }),
    }),
    PrismaModule,
    MailModule,
    OtpModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    FxModule,
    FeesModule,
    BeneficiariesModule,
    TransfersModule,
    CryptoModule,
    KycModule,
    P2pModule,
    CardsModule,
    MerchantModule,
    AiModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
