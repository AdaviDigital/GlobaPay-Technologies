import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrencyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';

const DEFAULT_QUOTE = 'USDT';

@Injectable()
export class CryptoPricesService {
  private readonly logger = new Logger(CryptoPricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async getPrice(baseCode: string, quoteCode: string = DEFAULT_QUOTE) {
    const rate = await this.fx.getRate(baseCode, quoteCode);
    return { base: baseCode, quote: quoteCode, price: rate };
  }

  async listPrices(quoteCode: string = DEFAULT_QUOTE) {
    const cryptoCurrencies = await this.prisma.currency.findMany({
      where: { type: CurrencyType.CRYPTO, isActive: true },
    });

    const prices = await Promise.all(
      cryptoCurrencies.map(async (currency) => {
        try {
          const rate = await this.fx.getRate(currency.code, quoteCode);
          return { code: currency.code, name: currency.name, symbol: currency.symbol, price: rate };
        } catch {
          return null;
        }
      }),
    );

    return prices.filter((p): p is NonNullable<typeof p> => p !== null);
  }

  /**
   * Simulates a live market by nudging every crypto/USDT rate with a small
   * random walk each tick. Swapping this for a real market-data feed later
   * means replacing this one method — everything downstream (orders, alerts,
   * the FX module) already reads prices through FxService/ExchangeRate.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick() {
    try {
      const usdt = await this.prisma.currency.findUnique({ where: { code: DEFAULT_QUOTE } });
      if (!usdt) return;

      const cryptoCurrencies = await this.prisma.currency.findMany({
        where: { type: CurrencyType.CRYPTO, isActive: true, code: { not: DEFAULT_QUOTE } },
      });

      for (const currency of cryptoCurrencies) {
        const existing = await this.prisma.exchangeRate.findUnique({
          where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: currency.id, quoteCurrencyId: usdt.id } },
        });
        if (!existing) continue;

        // ±0.75% random walk per tick
        const driftPercent = (Math.random() - 0.5) * 0.015;
        const newRate = new Prisma.Decimal(existing.rate).times(1 + driftPercent);

        await this.prisma.exchangeRate.update({
          where: { id: existing.id },
          data: { rate: newRate, fetchedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.error('Price tick failed', error instanceof Error ? error.stack : error);
    }
  }
}
