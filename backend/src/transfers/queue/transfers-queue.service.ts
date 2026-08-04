import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const TRANSFERS_QUEUE = 'transfers-settlement';

@Injectable()
export class TransfersQueueService {
  constructor(@InjectQueue(TRANSFERS_QUEUE) private readonly queue: Queue) {}

  async scheduleSettlement(transferId: string, delayMs: number) {
    await this.queue.add(
      'settle',
      { transferId },
      {
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
