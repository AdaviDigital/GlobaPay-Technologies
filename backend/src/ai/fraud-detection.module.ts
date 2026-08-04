import { Module } from '@nestjs/common';
import { FraudDetectionService } from './fraud-detection.service';

@Module({
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
