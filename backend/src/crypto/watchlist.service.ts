import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';
import { MailService } from '../mail/mail.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly mail: MailService,
  ) {}

  // ---- Watchlist -----------------------------------------------------------

  async addToWatchlist(userId: string, currencyCode: string) {
    const currency = await this.prisma.currency.findUnique({ where: { code: currencyCode } });
    if (!currency) throw new BadRequestException(`Unknown currency ${currencyCode}`);

    return this.prisma.watchlistItem.upsert({
      where: { userId_currencyCode: { userId, currencyCode } },
      update: {},
      create: { userId, currencyCode },
    });
  }

  async removeFromWatchlist(userId: string, currencyCode: string) {
    await this.prisma.watchlistItem.deleteMany({ where: { userId, currencyCode } });
    return { removed: true };
  }

  async listWatchlist(userId: string) {
    const items = await this.prisma.watchlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

    return Promise.all(
      items.map(async (item) => {
        try {
          const rate = await this.fx.getRate(item.currencyCode, 'USDT');
          return { currencyCode: item.currencyCode, price: rate };
        } catch {
          return { currencyCode: item.currencyCode, price: null };
        }
      }),
    );
  }

  // ---- Price alerts ----------------------------------------------------------

  async createAlert(userId: string, dto: CreateAlertDto) {
    const currency = await this.prisma.currency.findUnique({ where: { code: dto.currencyCode } });
    if (!currency) throw new BadRequestException(`Unknown currency ${dto.currencyCode}`);

    return this.prisma.priceAlert.create({
      data: {
        userId,
        currencyCode: dto.currencyCode,
        quoteCurrencyCode: dto.quoteCurrencyCode ?? 'USDT',
        direction: dto.direction,
        targetPrice: new Prisma.Decimal(dto.targetPrice),
      },
    });
  }

  async listAlerts(userId: string) {
    return this.prisma.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async deleteAlert(userId: string, id: string) {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.userId !== userId) throw new ForbiddenException('This alert does not belong to you');
    await this.prisma.priceAlert.delete({ where: { id } });
    return { deleted: true };
  }

  /** Runs on a tick: checks every un-triggered alert against the live price. */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkAlerts() {
    try {
      const pending = await this.prisma.priceAlert.findMany({
        where: { isTriggered: false },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const alert of pending) {
        let currentPrice: Prisma.Decimal;
        try {
          currentPrice = (await this.fx.getRate(alert.currencyCode, alert.quoteCurrencyCode)) as Prisma.Decimal;
        } catch {
          continue;
        }

        const target = new Prisma.Decimal(alert.targetPrice);
        const hit =
          alert.direction === 'ABOVE' ? currentPrice.greaterThanOrEqualTo(target) : currentPrice.lessThanOrEqualTo(target);

        if (!hit) continue;

        await this.prisma.priceAlert.update({
          where: { id: alert.id },
          data: { isTriggered: true, triggeredAt: new Date() },
        });

        if (alert.user.email) {
          await this.mail
            .sendPriceAlertEmail(alert.user.email, alert.currencyCode, alert.quoteCurrencyCode, currentPrice.toString(), alert.direction)
            .catch((error) => this.logger.warn(`Failed to send price alert email: ${error}`));
        }
      }
    } catch (error) {
      this.logger.error('Price alert check failed', error instanceof Error ? error.stack : error);
    }
  }
}
