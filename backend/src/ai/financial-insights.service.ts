import { Injectable } from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendingByCategory(userId: string, sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const transfers = await this.prisma.transfer.findMany({
      where: { userId, status: TransferStatus.COMPLETED, createdAt: { gte: since } },
      select: { category: true, totalDebit: true, sourceCurrencyCode: true },
    });

    const byCategory = new Map<string, Prisma.Decimal>();
    for (const t of transfers) {
      const key = t.category ?? 'Other';
      byCategory.set(key, (byCategory.get(key) ?? new Prisma.Decimal(0)).plus(t.totalDebit));
    }

    return Array.from(byCategory.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total.comparedTo(a.total));
  }

  async getBudgetStatus(userId: string) {
    const budgets = await this.prisma.budget.findMany({ where: { userId } });
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.prisma.transfer.aggregate({
          where: {
            userId,
            status: TransferStatus.COMPLETED,
            category: budget.category,
            sourceCurrencyCode: budget.currencyCode,
            createdAt: { gte: monthStart },
          },
          _sum: { totalDebit: true },
        });
        const spentAmount = new Prisma.Decimal(spent._sum.totalDebit ?? 0);
        return {
          category: budget.category,
          currencyCode: budget.currencyCode,
          monthlyLimit: budget.monthlyLimit,
          spent: spentAmount,
          remaining: new Prisma.Decimal(budget.monthlyLimit).minus(spentAmount),
          percentUsed: new Prisma.Decimal(budget.monthlyLimit).isZero()
            ? 0
            : spentAmount.dividedBy(budget.monthlyLimit).times(100).toDecimalPlaces(1).toNumber(),
        };
      }),
    );
  }

  /**
   * A deterministic, explainable score (0-100) — not an LLM judgment call,
   * on purpose. Financial health scoring should be reproducible and
   * auditable, not vary between runs of the same underlying data. Weighted
   * across three signals: savings behavior, spending consistency, and
   * wallet/asset diversification.
   */
  async getFinancialHealthScore(userId: string) {
    const [wallets, last90DaysTransfers, budgetStatus] = await Promise.all([
      this.prisma.wallet.findMany({ where: { userId }, include: { currency: true } }),
      this.prisma.transfer.findMany({
        where: { userId, status: TransferStatus.COMPLETED, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        select: { totalDebit: true, createdAt: true },
      }),
      this.getBudgetStatus(userId),
    ]);

    const factors: { label: string; score: number; weight: number; note: string }[] = [];

    // Factor 1 (weight 40): diversification — how many distinct currencies/assets held with a positive balance
    const fundedWallets = wallets.filter((w) => new Prisma.Decimal(w.balance).greaterThan(0));
    const diversificationScore = Math.min(fundedWallets.length * 20, 100);
    factors.push({
      label: 'Diversification',
      score: diversificationScore,
      weight: 0.4,
      note: `${fundedWallets.length} funded wallet${fundedWallets.length === 1 ? '' : 's'}`,
    });

    // Factor 2 (weight 35): spending consistency — lower week-to-week volatility scores higher
    const weeklyTotals = new Map<number, Prisma.Decimal>();
    for (const t of last90DaysTransfers) {
      const weekIndex = Math.floor((Date.now() - t.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
      weeklyTotals.set(weekIndex, (weeklyTotals.get(weekIndex) ?? new Prisma.Decimal(0)).plus(t.totalDebit));
    }
    const totals = Array.from(weeklyTotals.values()).map((d) => d.toNumber());
    let consistencyScore = 70; // neutral default with insufficient data
    if (totals.length >= 2) {
      const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
      const variance = totals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / totals.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = mean === 0 ? 0 : stdDev / mean;
      consistencyScore = Math.max(0, Math.min(100, 100 - coefficientOfVariation * 50));
    }
    factors.push({ label: 'Spending consistency', score: consistencyScore, weight: 0.35, note: `${totals.length} weeks of activity observed` });

    // Factor 3 (weight 25): staying within self-set budgets, if any exist
    let budgetScore = 75; // neutral default if the user hasn't set any budgets
    if (budgetStatus.length > 0) {
      const withinBudgetCount = budgetStatus.filter((b) => b.percentUsed <= 100).length;
      budgetScore = (withinBudgetCount / budgetStatus.length) * 100;
    }
    factors.push({ label: 'Budget adherence', score: budgetScore, weight: 0.25, note: `${budgetStatus.length} active budget${budgetStatus.length === 1 ? '' : 's'}` });

    const overall = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

    return { score: overall, factors };
  }
}
