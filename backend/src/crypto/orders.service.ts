import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { LedgerEntryType, OrderSide, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { FxService } from '../fx/fx.service';
import { AuthService } from '../auth/auth.service';
import { PlaceOrderDto } from './dto/place-order.dto';

const TRADING_FEE_PERCENT = new Prisma.Decimal(0.0015); // 0.15%, flat across the board for Phase 3

function generateReference(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly fx: FxService,
    private readonly auth: AuthService,
  ) {}

  async placeOrder(userId: string, dto: PlaceOrderDto) {
    await this.auth.verifyPin(userId, dto.pin);

    if (dto.baseCurrencyCode === dto.quoteCurrencyCode) {
      throw new BadRequestException('Base and quote currencies must differ');
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    if (dto.type !== OrderType.MARKET && !dto.triggerPrice) {
      throw new BadRequestException('Limit and stop orders require a trigger price');
    }

    const reference = generateReference();

    if (dto.type === OrderType.MARKET) {
      return this.executeMarketOrder({
        userId,
        reference,
        side: dto.side,
        baseCurrencyCode: dto.baseCurrencyCode,
        quoteCurrencyCode: dto.quoteCurrencyCode,
        quantity,
      });
    }

    // LIMIT / STOP: no funds move yet — the scheduler fills this against the
    // live price once the trigger condition is met (see OrdersSchedulerService).
    return this.prisma.order.create({
      data: {
        reference,
        userId,
        side: dto.side,
        type: dto.type,
        status: OrderStatus.OPEN,
        baseCurrencyCode: dto.baseCurrencyCode,
        quoteCurrencyCode: dto.quoteCurrencyCode,
        quantity,
        triggerPrice: new Prisma.Decimal(dto.triggerPrice!),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  /**
   * Fills an order at the current market price. GlobaPay is the counterparty
   * on every trade (no cross-user order book) — see the Order model comment
   * in schema.prisma for why, and how this would be swapped for real
   * exchange liquidity later.
   */
  private async executeMarketOrder(params: {
    userId: string;
    reference: string;
    side: OrderSide;
    baseCurrencyCode: string;
    quoteCurrencyCode: string;
    quantity: Prisma.Decimal;
    orderId?: string;
  }) {
    const { rate: price } = await this.fx.convert(1, params.baseCurrencyCode, params.quoteCurrencyCode);
    const quoteAmount = params.quantity.times(price);
    const fee = quoteAmount.times(TRADING_FEE_PERCENT);

    const baseWallet = await this.wallets.getOrCreateWallet(params.userId, params.baseCurrencyCode);
    const quoteWallet = await this.wallets.getOrCreateWallet(params.userId, params.quoteCurrencyCode);

    const filled = await this.prisma.$transaction(async (tx) => {
      if (params.side === OrderSide.BUY) {
        // Spend quote currency (e.g. USDT), receive base currency (e.g. BTC).
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: quoteWallet.id,
          type: LedgerEntryType.DEBIT,
          amount: quoteAmount.plus(fee),
          reference: `${params.reference}-DEBIT`,
          description: `Buy ${params.quantity} ${params.baseCurrencyCode}`,
        });
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: baseWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: params.quantity,
          reference: `${params.reference}-CREDIT`,
          description: `Bought ${params.baseCurrencyCode}`,
        });
      } else {
        // Sell base currency, receive quote currency minus the fee.
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: baseWallet.id,
          type: LedgerEntryType.DEBIT,
          amount: params.quantity,
          reference: `${params.reference}-DEBIT`,
          description: `Sell ${params.quantity} ${params.baseCurrencyCode}`,
        });
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: quoteWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: quoteAmount.minus(fee),
          reference: `${params.reference}-CREDIT`,
          description: `Sold ${params.baseCurrencyCode}`,
        });
      }

      const data = {
        side: params.side,
        status: OrderStatus.FILLED,
        filledPrice: price,
        filledQuoteAmount: quoteAmount,
        feeAmount: fee,
        filledAt: new Date(),
      };

      if (params.orderId) {
        return tx.order.update({ where: { id: params.orderId }, data });
      }

      return tx.order.create({
        data: {
          reference: params.reference,
          userId: params.userId,
          type: OrderType.MARKET,
          baseCurrencyCode: params.baseCurrencyCode,
          quoteCurrencyCode: params.quoteCurrencyCode,
          quantity: params.quantity,
          ...data,
        },
      });
    });

    return filled;
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.getOwned(userId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new ForbiddenException('Only open limit/stop orders can be cancelled');
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getOwned(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('This order does not belong to you');
    return order;
  }

  async getPortfolio(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, currency: { type: 'CRYPTO' } },
      include: { currency: true },
    });

    const holdings = await Promise.all(
      wallets
        .filter((w) => new Prisma.Decimal(w.balance).greaterThan(0))
        .map(async (wallet) => {
          let valueInUsdt = new Prisma.Decimal(0);
          try {
            const { convertedAmount } = await this.fx.convert(wallet.balance, wallet.currency.code, 'USDT');
            valueInUsdt = convertedAmount;
          } catch {
            // No route to price this asset right now — report the holding with a zero valuation
            // rather than dropping it, so the user still sees the balance exists.
          }
          return {
            currencyCode: wallet.currency.code,
            currencyName: wallet.currency.name,
            balance: wallet.balance,
            valueInUsdt,
          };
        }),
    );

    const totalValueInUsdt = holdings.reduce((sum, h) => sum.plus(h.valueInUsdt), new Prisma.Decimal(0));

    return { holdings, totalValueInUsdt };
  }

  /**
   * Called by OrdersSchedulerService on each tick: fills any OPEN limit/stop
   * order whose trigger condition the current price now satisfies, and
   * expires anything past its expiresAt.
   */
  async processOpenOrders() {
    const openOrders = await this.prisma.order.findMany({ where: { status: OrderStatus.OPEN } });

    for (const order of openOrders) {
      if (order.expiresAt && order.expiresAt < new Date()) {
        await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.EXPIRED } });
        continue;
      }

      let currentPrice: Prisma.Decimal;
      try {
        currentPrice = (await this.fx.getRate(order.baseCurrencyCode, order.quoteCurrencyCode)) as Prisma.Decimal;
      } catch {
        continue; // no route to price this pair right now — try again next tick
      }

      const triggerPrice = new Prisma.Decimal(order.triggerPrice!);
      const shouldFill =
        order.type === OrderType.LIMIT
          ? order.side === OrderSide.BUY
            ? currentPrice.lessThanOrEqualTo(triggerPrice)
            : currentPrice.greaterThanOrEqualTo(triggerPrice)
          : // STOP
            order.side === OrderSide.BUY
            ? currentPrice.greaterThanOrEqualTo(triggerPrice)
            : currentPrice.lessThanOrEqualTo(triggerPrice);

      if (!shouldFill) continue;

      await this.executeMarketOrder({
        userId: order.userId,
        reference: order.reference,
        side: order.side,
        baseCurrencyCode: order.baseCurrencyCode,
        quoteCurrencyCode: order.quoteCurrencyCode,
        quantity: new Prisma.Decimal(order.quantity),
        orderId: order.id,
      }).catch(async () => {
        // Most likely insufficient balance at fill time (funds aren't reserved
        // when a limit/stop order is placed — see the Order model comment).
        // Cancel rather than leave it silently stuck OPEN forever.
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
        });
      });
    }
  }
}
