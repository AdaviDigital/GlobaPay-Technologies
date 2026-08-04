import { Injectable } from '@nestjs/common';
import { FraudAlertSeverity, Prisma, TransferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FraudDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs a handful of deterministic heuristics against a just-created
   * transfer and raises a FraudAlert for anything that looks unusual. This
   * is pattern-matching against the user's own history, not a trained
   * model — cheap, explainable, and reasonable as a first layer, but it
   * will miss anything a real ML-based fraud system would catch. Never
   * blocks the transfer itself; alerts are for review only.
   */
  async evaluateTransfer(transferId: string): Promise<void> {
    const transfer = await this.prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) return;

    const reasons: { reason: string; severity: FraudAlertSeverity }[] = [];

    // Heuristic 1: this transfer is much larger than the user's recent average
    const recentTransfers = await this.prisma.transfer.findMany({
      where: {
        userId: transfer.userId,
        status: TransferStatus.COMPLETED,
        id: { not: transfer.id },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { totalDebit: true },
      take: 50,
    });

    if (recentTransfers.length >= 3) {
      const avg = recentTransfers
        .reduce((sum, t) => sum.plus(t.totalDebit), new Prisma.Decimal(0))
        .dividedBy(recentTransfers.length);
      if (avg.greaterThan(0) && new Prisma.Decimal(transfer.totalDebit).greaterThan(avg.times(5))) {
        reasons.push({
          reason: `This transfer (${transfer.totalDebit} ${transfer.sourceCurrencyCode}) is more than 5x your recent average (${avg.toFixed(2)})`,
          severity: FraudAlertSeverity.MEDIUM,
        });
      }
    }

    // Heuristic 2: multiple transfers in a very short window (possible automation/compromise)
    const lastFiveMinutes = await this.prisma.transfer.count({
      where: { userId: transfer.userId, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    });
    if (lastFiveMinutes >= 5) {
      reasons.push({
        reason: `${lastFiveMinutes} transfers were initiated within the last 5 minutes`,
        severity: FraudAlertSeverity.HIGH,
      });
    }

    // Heuristic 3: first-ever transfer to this beneficiary, above a fixed threshold
    if (transfer.beneficiaryId) {
      const priorToSameBeneficiary = await this.prisma.transfer.count({
        where: { userId: transfer.userId, beneficiaryId: transfer.beneficiaryId, id: { not: transfer.id } },
      });
      if (priorToSameBeneficiary === 0 && new Prisma.Decimal(transfer.totalDebit).greaterThan(1000)) {
        reasons.push({
          reason: 'First transfer to this beneficiary, and it is a large amount',
          severity: FraudAlertSeverity.LOW,
        });
      }
    }

    for (const { reason, severity } of reasons) {
      await this.prisma.fraudAlert.create({
        data: {
          userId: transfer.userId,
          severity,
          reason,
          relatedEntityType: 'Transfer',
          relatedEntityId: transfer.id,
        },
      });
    }
  }

  async listForUser(userId: string) {
    return this.prisma.fraudAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async dismiss(userId: string, alertId: string) {
    const alert = await this.prisma.fraudAlert.findUnique({ where: { id: alertId } });
    if (!alert || alert.userId !== userId) return null;
    return this.prisma.fraudAlert.update({ where: { id: alertId }, data: { status: 'DISMISSED', resolvedAt: new Date(), resolvedById: userId } });
  }
}
