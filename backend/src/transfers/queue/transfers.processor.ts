import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TRANSFERS_QUEUE } from './transfers-queue.service';
import { TransfersService } from '../transfers.service';

@Processor(TRANSFERS_QUEUE)
export class TransfersProcessor extends WorkerHost {
  private readonly logger = new Logger(TransfersProcessor.name);

  constructor(private readonly transfersService: TransfersService) {
    super();
  }

  async process(job: Job<{ transferId: string }>): Promise<void> {
    if (job.name !== 'settle') return;

    this.logger.log(`Settling transfer ${job.data.transferId}`);
    await this.transfersService.settleExternalTransfer(job.data.transferId);
  }
}
