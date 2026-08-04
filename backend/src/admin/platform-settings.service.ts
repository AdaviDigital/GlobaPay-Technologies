import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateExchangeRateDto, UpsertFeatureFlagDto } from './dto/admin.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Feature flags -------------------------------------------------------

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertFeatureFlag(dto: UpsertFeatureFlagDto) {
    return this.prisma.featureFlag.upsert({
      where: { key: dto.key },
      update: { isEnabled: dto.isEnabled, description: dto.description },
      create: { key: dto.key, isEnabled: dto.isEnabled, description: dto.description },
    });
  }

  async isFeatureEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    return flag?.isEnabled ?? false;
  }

  // ---- Fee rules -------------------------------------------------------------

  async listFeeRules() {
    return this.prisma.feeRule.findMany({ orderBy: [{ transferType: 'asc' }, { rail: 'asc' }] });
  }

  async setFeeRuleActive(id: string, isActive: boolean) {
    const rule = await this.prisma.feeRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Fee rule not found');
    return this.prisma.feeRule.update({ where: { id }, data: { isActive } });
  }

  async updateFeeRule(id: string, data: { percentageFee?: string; flatFee?: string; minFee?: string; maxFee?: string }) {
    const rule = await this.prisma.feeRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Fee rule not found');
    return this.prisma.feeRule.update({
      where: { id },
      data: {
        percentageFee: data.percentageFee ? new Prisma.Decimal(data.percentageFee) : undefined,
        flatFee: data.flatFee ? new Prisma.Decimal(data.flatFee) : undefined,
        minFee: data.minFee ? new Prisma.Decimal(data.minFee) : undefined,
        maxFee: data.maxFee ? new Prisma.Decimal(data.maxFee) : undefined,
      },
    });
  }

  // ---- Exchange rate overrides -----------------------------------------------

  async listExchangeRates() {
    const rates = await this.prisma.exchangeRate.findMany();
    const currencies = await this.prisma.currency.findMany();
    const codeById = new Map(currencies.map((c) => [c.id, c.code]));
    return rates.map((r) => ({
      id: r.id,
      base: codeById.get(r.baseCurrencyId),
      quote: codeById.get(r.quoteCurrencyId),
      rate: r.rate.toString(),
      fetchedAt: r.fetchedAt,
    }));
  }

  async setExchangeRate(dto: UpdateExchangeRateDto) {
    const [base, quote] = await Promise.all([
      this.prisma.currency.findUniqueOrThrow({ where: { code: dto.base } }),
      this.prisma.currency.findUniqueOrThrow({ where: { code: dto.quote } }),
    ]);

    return this.prisma.exchangeRate.upsert({
      where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: base.id, quoteCurrencyId: quote.id } },
      update: { rate: new Prisma.Decimal(dto.rate), source: 'admin_override', fetchedAt: new Date() },
      create: { baseCurrencyId: base.id, quoteCurrencyId: quote.id, rate: new Prisma.Decimal(dto.rate), source: 'admin_override' },
    });
  }
}
