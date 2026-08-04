import { Injectable } from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformSummary() {
    const [userCount, activeUserCount, walletCount, completedTransfers, openOrders, pendingKyc, openDisputes] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.wallet.count(),
      this.prisma.transfer.findMany({
        where: { status: TransferStatus.COMPLETED },
        select: { totalDebit: true, feeAmount: true, sourceCurrencyCode: true },
      }),
      this.prisma.order.count({ where: { status: 'OPEN' } }),
      this.prisma.kycSubmission.count({ where: { status: { in: ['PENDING', 'IN_REVIEW'] } } }),
      this.prisma.p2POrder.count({ where: { status: 'DISPUTED' } }),
    ]);

    // Fee revenue grouped by currency — currencies can't be summed together meaningfully
    const feesByCurrency = new Map<string, Prisma.Decimal>();
    const volumeByCurrency = new Map<string, Prisma.Decimal>();
    for (const t of completedTransfers) {
      feesByCurrency.set(t.sourceCurrencyCode, (feesByCurrency.get(t.sourceCurrencyCode) ?? new Prisma.Decimal(0)).plus(t.feeAmount));
      volumeByCurrency.set(t.sourceCurrencyCode, (volumeByCurrency.get(t.sourceCurrencyCode) ?? new Prisma.Decimal(0)).plus(t.totalDebit));
    }

    return {
      userCount,
      activeUserCount,
      walletCount,
      completedTransferCount: completedTransfers.length,
      openCryptoOrders: openOrders,
      pendingKycSubmissions: pendingKyc,
      openP2pDisputes: openDisputes,
      feeRevenueByCurrency: Array.from(feesByCurrency.entries()).map(([currency, total]) => ({ currency, total: total.toString() })),
      transferVolumeByCurrency: Array.from(volumeByCurrency.entries()).map(([currency, total]) => ({ currency, total: total.toString() })),
    };
  }

  async getUserGrowth(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const u of users) {
      const key = u.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
