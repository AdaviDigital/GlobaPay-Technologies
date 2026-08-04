import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersSchedulerService {
  private readonly logger = new Logger(OrdersSchedulerService.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleOpenOrders() {
    try {
      await this.ordersService.processOpenOrders();
    } catch (error) {
      this.logger.error('Failed while processing open orders', error instanceof Error ? error.stack : error);
    }
  }
}
