import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns how many units of `quoteCode` one unit of `baseCode` buys.
   * Tries, in order: same currency (rate 1), a direct row, the inverse of a
   * direct row, and finally a bridge through USD — so seeding a handful of
   * USD-anchored pairs is enough to quote almost any combination.
   */
  async getRate(baseCode: string, quoteCode: string): Promise<Prisma.Decimal> {
    if (baseCode === quoteCode) {
      return new Prisma.Decimal(1);
    }

    const [base, quote] = await Promise.all([
      this.prisma.currency.findUnique({ where: { code: baseCode } }),
      this.prisma.currency.findUnique({ where: { code: quoteCode } }),
    ]);

    if (!base || !quote) {
      throw new BadRequestException('Unsupported currency');
    }

    const direct = await this.prisma.exchangeRate.findUnique({
      where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: base.id, quoteCurrencyId: quote.id } },
    });
    if (direct) return new Prisma.Decimal(direct.rate);

    const inverse = await this.prisma.exchangeRate.findUnique({
      where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: quote.id, quoteCurrencyId: base.id } },
    });
    if (inverse) return new Prisma.Decimal(1).dividedBy(inverse.rate);

    // Bridge through USD: base->USD->quote
    const usd = await this.prisma.currency.findUnique({ where: { code: 'USD' } });
    if (usd && usd.id !== base.id && usd.id !== quote.id) {
      const baseToUsd = await this.rateBetweenIds(base.id, usd.id);
      const usdToQuote = await this.rateBetweenIds(usd.id, quote.id);
      if (baseToUsd && usdToQuote) {
        return baseToUsd.times(usdToQuote);
      }
    }

    throw new BadRequestException(`No exchange rate available for ${baseCode} → ${quoteCode}`);
  }

  private async rateBetweenIds(baseId: string, quoteId: string): Promise<Prisma.Decimal | null> {
    if (baseId === quoteId) return new Prisma.Decimal(1);

    const direct = await this.prisma.exchangeRate.findUnique({
      where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: baseId, quoteCurrencyId: quoteId } },
    });
    if (direct) return new Prisma.Decimal(direct.rate);

    const inverse = await this.prisma.exchangeRate.findUnique({
      where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: quoteId, quoteCurrencyId: baseId } },
    });
    if (inverse) return new Prisma.Decimal(1).dividedBy(inverse.rate);

    return null;
  }

  async convert(amount: Prisma.Decimal | number | string, baseCode: string, quoteCode: string) {
    const rate = await this.getRate(baseCode, quoteCode);
    const convertedAmount = new Prisma.Decimal(amount).times(rate);
    return { rate, convertedAmount };
  }

  async listRates() {
    const rates = await this.prisma.exchangeRate.findMany();
    const currencies = await this.prisma.currency.findMany();
    const codeById = new Map(currencies.map((c) => [c.id, c.code]));

    return rates.map((rate) => ({
      base: codeById.get(rate.baseCurrencyId),
      quote: codeById.get(rate.quoteCurrencyId),
      rate: rate.rate,
      fetchedAt: rate.fetchedAt,
    }));
  }
}
