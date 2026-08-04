import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  BeneficiaryType,
  LedgerEntryType,
  Prisma,
  TransferRail,
  TransferStatus,
  TransferType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { FxService } from '../fx/fx.service';
import { FeesService } from '../fees/fees.service';
import { AuthService } from '../auth/auth.service';
import { CategorizationService } from '../ai/categorization.service';
import { FraudDetectionService } from '../ai/fraud-detection.service';
import { MockBankProviderService } from './providers/mock-bank-provider.service';
import { TransfersQueueService } from './queue/transfers-queue.service';
import { WalletToWalletDto } from './dto/wallet-to-wallet.dto';
import { CurrencyConversionDto } from './dto/currency-conversion.dto';
import { BankTransferDto } from './dto/bank-transfer.dto';

function generateReference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function addInterval(date: Date, frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Date {
  const next = new Date(date);
  if (frequency === 'DAILY') next.setDate(next.getDate() + 1);
  if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
  if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  return next;
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly fx: FxService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
    private readonly provider: MockBankProviderService,
    private readonly queue: TransfersQueueService,
    private readonly categorization: CategorizationService,
    private readonly fraudDetection: FraudDetectionService,
  ) {}

  // ---------------------------------------------------------------------
  // Wallet-to-wallet (instant, same platform, free)
  // ---------------------------------------------------------------------

  async createWalletToWallet(userId: string, dto: WalletToWalletDto) {
    await this.auth.verifyPin(userId, dto.pin);

    const sourceWallet = await this.wallets.getOne(userId, dto.sourceWalletId);

    const recipientId = await this.resolveRecipientUserId(userId, dto.beneficiaryId, dto.recipientTag);
    const destinationWallet = await this.wallets.getOrCreateWallet(recipientId, sourceWallet.currency.code);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const fee = await this.fees.calculateFee({
      transferType: TransferType.WALLET_TO_WALLET,
      rail: TransferRail.INTERNAL,
      currencyCode: sourceWallet.currency.code,
      amount,
    });

    const reference = generateReference('W2W');

    const transfer = await this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: sourceWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: amount.plus(fee),
        reference: `${reference}-DEBIT`,
        description: `Transfer to ${dto.recipientTag ?? 'GlobaPay user'}`,
      });

      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: destinationWallet.id,
        type: LedgerEntryType.CREDIT,
        amount,
        reference: `${reference}-CREDIT`,
        description: 'Transfer received',
      });

      return tx.transfer.create({
        data: {
          reference,
          userId,
          type: TransferType.WALLET_TO_WALLET,
          rail: TransferRail.INTERNAL,
          status: TransferStatus.COMPLETED,
          sourceWalletId: sourceWallet.id,
          destinationWalletId: destinationWallet.id,
          beneficiaryId: dto.beneficiaryId,
          sourceAmount: amount,
          sourceCurrencyCode: sourceWallet.currency.code,
          destinationAmount: amount,
          destinationCurrencyCode: sourceWallet.currency.code,
          feeAmount: fee,
          totalDebit: amount.plus(fee),
          narration: dto.narration,
          category: this.categorization.categorize(dto.narration ?? 'Transfer to GlobaPay user'),
          completedAt: new Date(),
        },
      });
    });

    this.fraudDetection.evaluateTransfer(transfer.id).catch(() => undefined);

    return transfer;
  }

  private async resolveRecipientUserId(senderId: string, beneficiaryId?: string, recipientTag?: string) {
    if (beneficiaryId) {
      const beneficiary = await this.prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
      if (!beneficiary || beneficiary.userId !== senderId) {
        throw new NotFoundException('Beneficiary not found');
      }
      if (beneficiary.type !== BeneficiaryType.GLOBAPAY_USER || !beneficiary.beneficiaryUserId) {
        throw new BadRequestException('This beneficiary is not a GlobaPay user');
      }
      return beneficiary.beneficiaryUserId;
    }

    if (!recipientTag) {
      throw new BadRequestException('Provide a beneficiaryId or a recipient email/phone');
    }

    const recipient = await this.prisma.user.findFirst({
      where: { OR: [{ email: recipientTag }, { phone: recipientTag }] },
    });
    if (!recipient) {
      throw new NotFoundException('No GlobaPay user found with that email or phone number');
    }
    if (recipient.id === senderId) {
      throw new BadRequestException('You cannot send money to yourself');
    }
    return recipient.id;
  }

  // ---------------------------------------------------------------------
  // Currency conversion (instant, same user, both wallets)
  // ---------------------------------------------------------------------

  async createCurrencyConversion(userId: string, dto: CurrencyConversionDto) {
    await this.auth.verifyPin(userId, dto.pin);

    const sourceWallet = await this.wallets.getOne(userId, dto.sourceWalletId);
    if (sourceWallet.currency.code === dto.destinationCurrencyCode) {
      throw new BadRequestException('Source and destination currencies must differ');
    }

    const destinationWallet = await this.wallets.getOrCreateWallet(userId, dto.destinationCurrencyCode);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const fee = await this.fees.calculateFee({
      transferType: TransferType.CURRENCY_CONVERSION,
      rail: TransferRail.INTERNAL,
      currencyCode: sourceWallet.currency.code,
      amount,
    });

    const { rate, convertedAmount } = await this.fx.convert(
      amount,
      sourceWallet.currency.code,
      dto.destinationCurrencyCode,
    );

    const reference = generateReference('FX');

    const transfer = await this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: sourceWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: amount.plus(fee),
        reference: `${reference}-DEBIT`,
        description: `Convert to ${dto.destinationCurrencyCode}`,
      });

      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: destinationWallet.id,
        type: LedgerEntryType.CREDIT,
        amount: convertedAmount,
        reference: `${reference}-CREDIT`,
        description: `Converted from ${sourceWallet.currency.code}`,
      });

      return tx.transfer.create({
        data: {
          reference,
          userId,
          type: TransferType.CURRENCY_CONVERSION,
          rail: TransferRail.INTERNAL,
          status: TransferStatus.COMPLETED,
          sourceWalletId: sourceWallet.id,
          destinationWalletId: destinationWallet.id,
          sourceAmount: amount,
          sourceCurrencyCode: sourceWallet.currency.code,
          destinationAmount: convertedAmount,
          destinationCurrencyCode: dto.destinationCurrencyCode,
          exchangeRate: rate,
          feeAmount: fee,
          totalDebit: amount.plus(fee),
          category: 'Currency Exchange',
          completedAt: new Date(),
        },
      });
    });

    return transfer;
  }

  // ---------------------------------------------------------------------
  // Bank transfers (local/international) — debited now, settled async
  // ---------------------------------------------------------------------

  async createBankTransfer(userId: string, dto: BankTransferDto) {
    await this.auth.verifyPin(userId, dto.pin);

    const sourceWallet = await this.wallets.getOne(userId, dto.sourceWalletId);
    const beneficiary = await this.prisma.beneficiary.findUnique({ where: { id: dto.beneficiaryId } });
    if (!beneficiary || beneficiary.userId !== userId) {
      throw new NotFoundException('Beneficiary not found');
    }
    if (beneficiary.type !== BeneficiaryType.BANK_ACCOUNT) {
      throw new BadRequestException('This beneficiary is not a bank account');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const transferType = dto.rail === TransferRail.LOCAL_INSTANT ? TransferType.LOCAL_BANK : TransferType.INTERNATIONAL_BANK;

    const fee = await this.fees.calculateFee({
      transferType,
      rail: dto.rail,
      currencyCode: sourceWallet.currency.code,
      amount,
    });

    const reference = generateReference('TRF');
    const isScheduled = Boolean(dto.scheduledFor && new Date(dto.scheduledFor) > new Date());

    const transfer = await this.prisma.$transaction(async (tx) => {
      // Funds leave the wallet immediately, whether the transfer settles now
      // or is queued for later — this is what "money in flight" means here.
      // A future-dated (scheduled) transfer does NOT debit yet; it's just a
      // template the scheduler activates on its due date.
      if (!isScheduled) {
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: sourceWallet.id,
          type: LedgerEntryType.DEBIT,
          amount: amount.plus(fee),
          reference: `${reference}-DEBIT`,
          description: `Transfer to ${beneficiary.label}`,
        });
      }

      const created = await tx.transfer.create({
        data: {
          reference,
          userId,
          type: transferType,
          rail: dto.rail,
          status: isScheduled ? TransferStatus.SCHEDULED : TransferStatus.PENDING,
          sourceWalletId: sourceWallet.id,
          beneficiaryId: beneficiary.id,
          sourceAmount: amount,
          sourceCurrencyCode: sourceWallet.currency.code,
          destinationAmount: amount,
          destinationCurrencyCode: beneficiary.currencyCode ?? sourceWallet.currency.code,
          feeAmount: fee,
          totalDebit: amount.plus(fee),
          narration: dto.narration,
          category: this.categorization.categorize(dto.narration ?? `Transfer to ${beneficiary.label}`),
          scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
        },
      });

      if (isScheduled && dto.recurrenceFrequency) {
        await tx.recurrenceRule.create({
          data: {
            transferId: created.id,
            frequency: dto.recurrenceFrequency,
            nextRunAt: new Date(dto.scheduledFor!),
            endsAt: dto.recurrenceEndsAt ? new Date(dto.recurrenceEndsAt) : undefined,
          },
        });
      }

      return created;
    });

    if (!isScheduled) {
      const { providerReference } = this.provider.initiate(dto.rail);
      await this.prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.PROCESSING, providerReference },
      });
      await this.queue.scheduleSettlement(transfer.id, this.provider.getSettlementDelay(dto.rail));
    }

    return transfer;
  }

  /** Called by the BullMQ worker once the simulated settlement delay elapses. */
  async settleExternalTransfer(transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer || transfer.status !== TransferStatus.PROCESSING || !transfer.providerReference) {
      return; // already settled, cancelled, or not ready — nothing to do
    }

    const result = this.provider.settle(transfer.providerReference);

    if (result.success) {
      await this.prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.COMPLETED, completedAt: new Date() },
      });
      this.fraudDetection.evaluateTransfer(transfer.id).catch(() => undefined);
      return;
    }

    // Refund: the debit already happened at initiation, so failure means
    // crediting the source wallet back for the full amount + fee.
    await this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: transfer.sourceWalletId,
        type: LedgerEntryType.CREDIT,
        amount: transfer.totalDebit,
        reference: `${transfer.reference}-REFUND`,
        description: `Refund: ${result.failureReason}`,
      });

      await tx.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.FAILED, failureReason: result.failureReason },
      });
    });
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async listForUser(userId: string) {
    return this.prisma.transfer.findMany({
      where: { userId },
      include: { beneficiary: true, sourceWallet: { include: { currency: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOne(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { beneficiary: true, sourceWallet: { include: { currency: true } }, recurrence: true },
    });
    if (!transfer || transfer.userId !== userId) {
      throw new NotFoundException('Transfer not found');
    }
    return transfer;
  }

  async cancelScheduled(userId: string, id: string) {
    const transfer = await this.getOne(userId, id);
    if (transfer.status !== TransferStatus.SCHEDULED) {
      throw new ForbiddenException('Only scheduled transfers that have not run yet can be cancelled');
    }
    await this.prisma.$transaction([
      this.prisma.recurrenceRule.updateMany({ where: { transferId: id }, data: { isActive: false } }),
      this.prisma.transfer.update({ where: { id }, data: { status: TransferStatus.CANCELLED } }),
    ]);
    return { cancelled: true };
  }

  /**
   * Runs on a cron tick (see TransfersSchedulerService): finds recurrence
   * rules due to fire and spawns a fresh, real Transfer from the template's
   * details, then advances (or closes out) the rule.
   */
  async runDueRecurrences(now: Date) {
    const due = await this.prisma.recurrenceRule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      include: { transfer: true },
    });

    for (const rule of due) {
      const template = rule.transfer;

      await this.executeRecurrenceInstance(template).catch(() => {
        // A failed spawn (e.g. insufficient funds) doesn't crash the cron
        // loop — it just skips this cycle and tries again next time.
      });

      const nextRunAt = addInterval(rule.nextRunAt, rule.frequency);
      const isExpired = rule.endsAt ? nextRunAt > rule.endsAt : false;

      await this.prisma.recurrenceRule.update({
        where: { id: rule.id },
        data: { nextRunAt, isActive: !isExpired },
      });
    }
  }

  /**
   * Spawns a real, independent Transfer from a recurring template — debits
   * and queues settlement directly, bypassing the PIN check that guards the
   * interactive endpoint, since the account owner already authorized this
   * exact recurrence when they created it.
   */
  private async executeRecurrenceInstance(template: {
    userId: string;
    sourceWalletId: string;
    beneficiaryId: string | null;
    rail: TransferRail;
    sourceAmount: Prisma.Decimal;
    narration: string | null;
  }) {
    if (!template.beneficiaryId) return;

    const sourceWallet = await this.wallets.getOne(template.userId, template.sourceWalletId);
    const beneficiary = await this.prisma.beneficiary.findUniqueOrThrow({ where: { id: template.beneficiaryId } });
    const transferType = template.rail === TransferRail.LOCAL_INSTANT ? TransferType.LOCAL_BANK : TransferType.INTERNATIONAL_BANK;

    const fee = await this.fees.calculateFee({
      transferType,
      rail: template.rail,
      currencyCode: sourceWallet.currency.code,
      amount: template.sourceAmount,
    });

    const reference = generateReference('REC');

    const transfer = await this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: sourceWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: template.sourceAmount.plus(fee),
        reference: `${reference}-DEBIT`,
        description: `Recurring transfer to ${beneficiary.label}`,
      });

      return tx.transfer.create({
        data: {
          reference,
          userId: template.userId,
          type: transferType,
          rail: template.rail,
          status: TransferStatus.PENDING,
          sourceWalletId: sourceWallet.id,
          beneficiaryId: beneficiary.id,
          sourceAmount: template.sourceAmount,
          sourceCurrencyCode: sourceWallet.currency.code,
          destinationAmount: template.sourceAmount,
          destinationCurrencyCode: beneficiary.currencyCode ?? sourceWallet.currency.code,
          feeAmount: fee,
          totalDebit: template.sourceAmount.plus(fee),
          narration: template.narration ?? undefined,
          category: this.categorization.categorize(template.narration ?? `Transfer to ${beneficiary.label}`),
        },
      });
    });

    const { providerReference } = this.provider.initiate(template.rail);
    await this.prisma.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.PROCESSING, providerReference },
    });
    await this.queue.scheduleSettlement(transfer.id, this.provider.getSettlementDelay(template.rail));
  }
}
