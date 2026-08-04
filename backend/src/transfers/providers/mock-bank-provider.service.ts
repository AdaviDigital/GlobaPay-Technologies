import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TransferRail } from '@prisma/client';

export interface ProviderSettlementResult {
  success: boolean;
  providerReference: string;
  failureReason?: string;
}

/**
 * Stands in for a real banking-rail integration (SWIFT/ACH/SEPA/Faster
 * Payments gateway, or a local instant-payment switch). TransfersService only
 * depends on this interface, so wiring in a licensed provider later is a
 * matter of implementing `send`/`settle` here — no caller changes.
 */
@Injectable()
export class MockBankProviderService {
  private readonly settlementDelayMsByRail: Record<TransferRail, number> = {
    INTERNAL: 0,
    LOCAL_INSTANT: 3_000,
    FASTER_PAYMENTS: 5_000,
    SEPA: 15_000,
    ACH: 30_000,
    SWIFT: 60_000,
  };

  /** Simulated settlement delay, in ms, for a given rail. Used to schedule the settlement job. */
  getSettlementDelay(rail: TransferRail): number {
    return this.settlementDelayMsByRail[rail];
  }

  /** Initiates the transfer with the rail and returns a tracking reference immediately. */
  initiate(rail: TransferRail): { providerReference: string } {
    const prefix = { SWIFT: 'SWFT', ACH: 'ACH', SEPA: 'SEPA', FASTER_PAYMENTS: 'FPS', LOCAL_INSTANT: 'LCL', INTERNAL: 'INT' }[
      rail
    ];
    return { providerReference: `${prefix}-${randomBytes(6).toString('hex').toUpperCase()}` };
  }

  /**
   * Simulates the rail's eventual settlement callback. In production this
   * logic lives on the provider's side and arrives as a webhook instead.
   * Failure is intentionally rare but non-zero, so the failure/refund path
   * in TransfersService gets exercised realistically.
   */
  settle(providerReference: string): ProviderSettlementResult {
    const failed = Math.random() < 0.03;
    return failed
      ? { success: false, providerReference, failureReason: 'Beneficiary bank rejected the payment' }
      : { success: true, providerReference };
  }
}
