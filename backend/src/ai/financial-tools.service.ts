import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import { FinancialInsightsService } from './financial-insights.service';

@Injectable()
export class FinancialToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly insights: FinancialInsightsService,
  ) {}

  async getWalletBalances(userId: string) {
    const wallets = await this.prisma.wallet.findMany({ where: { userId }, include: { currency: true } });
    return wallets.map((w) => ({ currency: w.currency.code, balance: w.balance.toString(), type: w.currency.type }));
  }

  async getRecentTransactions(userId: string, params: { limit?: number; category?: string }) {
    const transfers = await this.prisma.transfer.findMany({
      where: { userId, category: params.category },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.limit ?? 10, 50),
      select: { reference: true, type: true, category: true, totalDebit: true, sourceCurrencyCode: true, status: true, createdAt: true, narration: true },
    });
    return transfers.map((t) => ({ ...t, totalDebit: t.totalDebit.toString() }));
  }

  async getSpendingByCategory(userId: string, days?: number) {
    const rows = await this.insights.getSpendingByCategory(userId, days ?? 30);
    return rows.map((r) => ({ category: r.category, total: r.total.toString() }));
  }

  async getFinancialHealthScore(userId: string) {
    return this.insights.getFinancialHealthScore(userId);
  }

  async getBudgetStatus(userId: string) {
    const rows = await this.insights.getBudgetStatus(userId);
    return rows.map((r) => ({
      ...r,
      monthlyLimit: r.monthlyLimit.toString(),
      spent: r.spent.toString(),
      remaining: r.remaining.toString(),
    }));
  }

  async getCryptoPortfolio(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, currency: { type: 'CRYPTO' } },
      include: { currency: true },
    });

    const holdings = await Promise.all(
      wallets
        .filter((w) => w.balance.greaterThan(0))
        .map(async (w) => {
          try {
            const { convertedAmount } = await this.fx.convert(w.balance, w.currency.code, 'USDT');
            return { asset: w.currency.code, balance: w.balance.toString(), valueInUsdt: convertedAmount.toString() };
          } catch {
            return { asset: w.currency.code, balance: w.balance.toString(), valueInUsdt: null };
          }
        }),
    );

    return holdings;
  }
}
