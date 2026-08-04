import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Default wallets every individual/business user receives on registration.
// Adding a new fiat currency later is a data change (Currency row), not a code change.
const DEFAULT_WALLET_CURRENCY_CODES = ['USD', 'GBP', 'EUR', 'CAD', 'NGN', 'AUD'];

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates one wallet per default fiat currency for a newly registered user. */
  async provisionDefaultWallets(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? this.prisma;

    const currencies = await db.currency.findMany({
      where: { code: { in: DEFAULT_WALLET_CURRENCY_CODES }, isActive: true },
    });

    if (currencies.length === 0) {
      // Currencies haven't been seeded yet — nothing to provision, but don't block registration.
      return;
    }

    await db.wallet.createMany({
      data: currencies.map((currency, index) => ({
        userId,
        currencyId: currency.id,
        isPrimary: currency.code === 'USD' || (index === 0 && !currencies.some((c) => c.code === 'USD')),
      })),
      skipDuplicates: true,
    });
  }

  async listForUser(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      include: { currency: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getOne(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
      include: { currency: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Moves an amount from a wallet's spendable balance into its frozen
   * balance — used to hold a seller's proceeds in escrow while a gift-card
   * P2P order is awaiting delivery/confirmation. No ledger entry is written
   * for this step (LedgerEntry represents real balance movements only); the
   * P2POrder's own status history is the audit trail for the freeze itself.
   * The eventual release back into balance IS ledgered, via
   * releaseFrozenToBalance below.
   */
  async holdInFrozenInTx(tx: Prisma.TransactionClient, walletId: string, amount: Prisma.Decimal | number | string) {
    return tx.wallet.update({
      where: { id: walletId },
      data: { frozenBalance: { increment: new Prisma.Decimal(amount) } },
    });
  }

  /** Releases a previously frozen amount into the wallet's spendable balance, with a ledger entry. */
  async releaseFrozenToBalanceInTx(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: Prisma.Decimal | number | string,
    reference: string,
    description: string,
  ) {
    await tx.wallet.update({
      where: { id: walletId },
      data: { frozenBalance: { decrement: new Prisma.Decimal(amount) } },
    });
    return this.applyLedgerMovementInTx(tx, { walletId, type: LedgerEntryType.CREDIT, amount, reference, description });
  }

  /** Cancels a hold without crediting balance here — used when the funds are being refunded to a *different* wallet instead. */
  async releaseFrozenOnlyInTx(tx: Prisma.TransactionClient, walletId: string, amount: Prisma.Decimal | number | string) {
    return tx.wallet.update({
      where: { id: walletId },
      data: { frozenBalance: { decrement: new Prisma.Decimal(amount) } },
    });
  }

  /**
   * Returns the user's wallet for a currency, creating it on demand if it
   * doesn't exist yet (e.g. a crypto wallet, which isn't auto-provisioned at
   * signup the way the default fiat set is). Used by transfers/conversion so
   * a recipient or sender is never blocked just for lacking a wallet.
   */
  async getOrCreateWallet(userId: string, currencyCode: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;

    const existing = await db.wallet.findFirst({
      where: { userId, currency: { code: currencyCode } },
      include: { currency: true },
    });
    if (existing) return existing;

    const currency = await db.currency.findUnique({ where: { code: currencyCode } });
    if (!currency || !currency.isActive) {
      throw new NotFoundException(`Currency ${currencyCode} is not supported`);
    }

    return db.wallet.create({
      data: { userId, currencyId: currency.id },
      include: { currency: true },
    });
  }

  async getStatement(userId: string, walletId: string) {
    await this.getOne(userId, walletId); // ownership check
    return this.prisma.ledgerEntry.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Applies a ledger-tracked credit or debit to a wallet inside a transaction.
   * This is the single choke point through which balances change, so every
   * movement is auditable via LedgerEntry — the foundation later phases
   * (transfers, trading, escrow) build on rather than mutating balances directly.
   */
  async applyLedgerMovement(params: {
    walletId: string;
    type: LedgerEntryType;
    amount: Prisma.Decimal | number | string;
    reference: string;
    description: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction((tx) => this.applyLedgerMovementInTx(tx, params));
  }

  /**
   * Same as applyLedgerMovement, but scoped to a transaction client the caller
   * already opened — so a transfer's debit and credit legs (or a debit and a
   * refund) can be composed into one atomic outer transaction.
   */
  async applyLedgerMovementInTx(
    tx: Prisma.TransactionClient,
    params: {
      walletId: string;
      type: LedgerEntryType;
      amount: Prisma.Decimal | number | string;
      reference: string;
      description: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const wallet = await tx.wallet.findUnique({ where: { id: params.walletId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const amount = new Prisma.Decimal(params.amount);
    const signedAmount = params.type === LedgerEntryType.CREDIT ? amount : amount.negated();
    const newBalance = new Prisma.Decimal(wallet.balance).plus(signedAmount);

    if (newBalance.isNegative()) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        type: params.type,
        amount,
        balanceAfter: newBalance,
        reference: params.reference,
        description: params.description,
        metadata: params.metadata,
      },
    });

    return { wallet: updatedWallet, ledgerEntry };
  }
}
