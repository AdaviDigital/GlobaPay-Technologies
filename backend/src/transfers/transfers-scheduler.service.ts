import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransfersService } from './transfers.service';

@Injectable()
export class TransfersSchedulerService {
  private readonly logger = new Logger(TransfersSchedulerService.name);

  constructor(private readonly transfersService: TransfersService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDueRecurrences() {
    try {
      await this.transfersService.runDueRecurrences(new Date());
    } catch (error) {
      this.logger.error('Failed while processing due recurring transfers', error instanceof Error ? error.stack : error);
    }
  }
}
