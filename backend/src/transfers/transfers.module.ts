import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { TransfersSchedulerService } from './transfers-scheduler.service';
import { MockBankProviderService } from './providers/mock-bank-provider.service';
import { TransfersQueueService, TRANSFERS_QUEUE } from './queue/transfers-queue.service';
import { TransfersProcessor } from './queue/transfers.processor';
import { WalletsModule } from '../wallets/wallets.module';
import { FxModule } from '../fx/fx.module';
import { FeesModule } from '../fees/fees.module';
import { AuthModule } from '../auth/auth.module';
import { CategorizationModule } from '../ai/categorization.module';
import { FraudDetectionModule } from '../ai/fraud-detection.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRANSFERS_QUEUE }),
    WalletsModule,
    FxModule,
    FeesModule,
    AuthModule,
    CategorizationModule,
    FraudDetectionModule,
  ],
  controllers: [TransfersController],
  providers: [
    TransfersService,
    TransfersSchedulerService,
    MockBankProviderService,
    TransfersQueueService,
    TransfersProcessor,
  ],
  exports: [TransfersService],
})
export class TransfersModule {}
