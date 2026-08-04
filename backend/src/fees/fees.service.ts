import { Injectable } from '@nestjs/common';
import { Prisma, TransferRail, TransferType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds the most specific active fee rule for this transfer type/rail/currency
   * and applies it to `amount`. Falls back to zero fee if nothing matches, so a
   * missing rule never blocks a transfer outright.
   */
  async calculateFee(params: {
    transferType: TransferType;
    rail: TransferRail;
    currencyCode: string;
    amount: Prisma.Decimal | number | string;
  }): Promise<Prisma.Decimal> {
    const candidates = await this.prisma.feeRule.findMany({
      where: {
        transferType: params.transferType,
        isActive: true,
        OR: [{ rail: params.rail }, { rail: null }],
      },
    });

    if (candidates.length === 0) {
      return new Prisma.Decimal(0);
    }

    // Prefer a rule that matches both rail and currency, then rail-only, then type-only.
    const rule =
      candidates.find((r) => r.rail === params.rail && r.currencyCode === params.currencyCode) ??
      candidates.find((r) => r.rail === params.rail && !r.currencyCode) ??
      candidates.find((r) => !r.rail && r.currencyCode === params.currencyCode) ??
      candidates.find((r) => !r.rail && !r.currencyCode) ??
      candidates[0];

    const amount = new Prisma.Decimal(params.amount);
    let fee = amount.times(rule.percentageFee).plus(rule.flatFee);

    if (rule.minFee && fee.lessThan(rule.minFee)) fee = new Prisma.Decimal(rule.minFee);
    if (rule.maxFee && fee.greaterThan(rule.maxFee)) fee = new Prisma.Decimal(rule.maxFee);

    return fee;
  }
}
