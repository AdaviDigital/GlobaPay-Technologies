import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pService } from './p2p.service';

@Injectable()
export class P2pSchedulerService {
  private readonly logger = new Logger(P2pSchedulerService.name);

  constructor(private readonly p2pService: P2pService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdueDeliveries() {
    try {
      await this.p2pService.expireOverdueDeliveries();
    } catch (error) {
      this.logger.error('Failed while expiring overdue P2P deliveries', error instanceof Error ? error.stack : error);
    }
  }
}
