import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { CardStatus, CardTransactionStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { IssueCardDto, SetCardLimitDto, SimulatePurchaseDto } from './dto/card.dto';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
  ) {}

  async issueCard(userId: string, dto: IssueCardDto) {
    const wallet = await this.wallets.getOne(userId, dto.walletId);
    if (wallet.currency.type !== 'FIAT') {
      throw new BadRequestException('Virtual cards can only be linked to a fiat wallet');
    }

    const now = new Date();
    return this.prisma.virtualCard.create({
      data: {
        userId,
        walletId: wallet.id,
        label: dto.label,
        brand: dto.brand,
        last4: randomInt(1000, 9999).toString(),
        expiryMonth: now.getMonth() + 1,
        expiryYear: now.getFullYear() + 3,
      },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.virtualCard.findMany({
      where: { userId },
      include: { wallet: { include: { currency: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOwnedCard(userId: string, cardId: string) {
    const card = await this.prisma.virtualCard.findUnique({ where: { id: cardId }, include: { wallet: { include: { currency: true } } } });
    if (!card) throw new NotFoundException('Card not found');
    if (card.userId !== userId) throw new ForbiddenException('This card does not belong to you');
    return card;
  }

  async freeze(userId: string, cardId: string) {
    await this.getOwnedCard(userId, cardId);
    return this.prisma.virtualCard.update({ where: { id: cardId }, data: { status: CardStatus.FROZEN } });
  }

  async unfreeze(userId: string, cardId: string) {
    const card = await this.getOwnedCard(userId, cardId);
    if (card.status === CardStatus.TERMINATED) {
      throw new BadRequestException('A terminated card cannot be reactivated — issue a new one instead');
    }
    return this.prisma.virtualCard.update({ where: { id: cardId }, data: { status: CardStatus.ACTIVE } });
  }

  async terminate(userId: string, cardId: string) {
    await this.getOwnedCard(userId, cardId);
    return this.prisma.virtualCard.update({ where: { id: cardId }, data: { status: CardStatus.TERMINATED } });
  }

  async setLimit(userId: string, cardId: string, dto: SetCardLimitDto) {
    await this.getOwnedCard(userId, cardId);
    return this.prisma.virtualCard.update({
      where: { id: cardId },
      data: { spendingLimitAmount: new Prisma.Decimal(dto.amount), spendingLimitPeriod: dto.period },
    });
  }

  async clearLimit(userId: string, cardId: string) {
    await this.getOwnedCard(userId, cardId);
    return this.prisma.virtualCard.update({
      where: { id: cardId },
      data: { spendingLimitAmount: null, spendingLimitPeriod: null },
    });
  }

  async getStatement(userId: string, cardId: string) {
    await this.getOwnedCard(userId, cardId);
    return this.prisma.cardTransaction.findMany({ where: { cardId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  private periodStart(period: string): Date {
    const now = new Date();
    if (period === 'DAILY') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(now.getFullYear(), now.getMonth(), 1); // MONTHLY
  }

  /**
   * Simulates a card-network authorization hitting GlobaPay, the way a real
   * issuing processor's webhook would — this is a demo endpoint the
   * cardholder calls directly, since there is no real card network wired up.
   * Declines are recorded (not silently dropped) so the statement reads like
   * a real card's would.
   */
  async simulatePurchase(userId: string, cardId: string, dto: SimulatePurchaseDto) {
    const card = await this.getOwnedCard(userId, cardId);
    const amount = new Prisma.Decimal(dto.amount);
    const currencyCode = dto.currencyCode ?? card.wallet.currency.code;

    const decline = async (reason: string) => {
      return this.prisma.cardTransaction.create({
        data: { cardId, amount, currencyCode, merchantName: dto.merchantName, status: CardTransactionStatus.DECLINED, declineReason: reason },
      });
    };

    if (card.status !== CardStatus.ACTIVE) {
      return decline(`Card is ${card.status.toLowerCase()}`);
    }
    if (currencyCode !== card.wallet.currency.code) {
      return decline('Currency mismatch with linked wallet');
    }

    if (card.spendingLimitAmount && card.spendingLimitPeriod) {
      const since = this.periodStart(card.spendingLimitPeriod);
      const spent = await this.prisma.cardTransaction.aggregate({
        where: { cardId, status: CardTransactionStatus.APPROVED, createdAt: { gte: since } },
        _sum: { amount: true },
      });
      const spentSoFar = new Prisma.Decimal(spent._sum.amount ?? 0);
      if (spentSoFar.plus(amount).greaterThan(card.spendingLimitAmount)) {
        return decline('Spending limit exceeded');
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: card.walletId,
          type: LedgerEntryType.DEBIT,
          amount,
          reference: `CARD-${card.id}-${Date.now()}`,
          description: `Card purchase at ${dto.merchantName}`,
        });
        return tx.cardTransaction.create({
          data: { cardId, amount, currencyCode, merchantName: dto.merchantName, status: CardTransactionStatus.APPROVED },
        });
      });
    } catch {
      return decline('Insufficient wallet balance');
    }
  }
}
