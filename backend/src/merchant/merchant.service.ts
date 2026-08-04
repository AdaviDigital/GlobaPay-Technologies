import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { CheckoutSessionStatus, InvoiceStatus, LedgerEntryType, Prisma, WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuthService } from '../auth/auth.service';
import { CreateInvoiceDto, CreateMerchantAccountDto, CreatePaymentLinkDto } from './dto/merchant.dto';
import { PayCheckoutDto } from './dto/pay-checkout.dto';

function generateReference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly auth: AuthService,
  ) {}

  // ---------------------------------------------------------------------
  // Account
  // ---------------------------------------------------------------------

  async createAccount(userId: string, dto: CreateMerchantAccountDto) {
    const existing = await this.prisma.merchantAccount.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('A merchant account already exists for this user');
    }

    const wallet = await this.wallets.getOne(userId, dto.walletId);
    if (wallet.currency.type !== 'FIAT') {
      throw new BadRequestException('Settlement wallet must be a fiat wallet');
    }

    const rawKey = `gp_live_${randomBytes(24).toString('hex')}`;
    const apiKeyHash = await argon2.hash(rawKey);

    const account = await this.prisma.merchantAccount.create({
      data: {
        userId,
        businessName: dto.businessName,
        walletId: wallet.id,
        webhookUrl: dto.webhookUrl,
        apiKeyPrefix: rawKey.slice(0, 16),
        apiKeyHash,
      },
    });

    // The raw key is only ever available here, at creation — it is not
    // recoverable afterward (only its hash and a display prefix are stored).
    return { ...account, apiKey: rawKey };
  }

  async getMyAccount(userId: string) {
    const account = await this.prisma.merchantAccount.findUnique({ where: { userId } });
    if (!account) throw new NotFoundException('No merchant account found for this user');
    return account;
  }

  private async requireAccount(userId: string) {
    const account = await this.prisma.merchantAccount.findUnique({ where: { userId } });
    if (!account) throw new NotFoundException('No merchant account found for this user');
    return account;
  }

  // ---------------------------------------------------------------------
  // Payment links
  // ---------------------------------------------------------------------

  async createPaymentLink(userId: string, dto: CreatePaymentLinkDto) {
    const account = await this.requireAccount(userId);
    const slug = randomUUID().slice(0, 10);

    return this.prisma.paymentLink.create({
      data: {
        merchantId: account.id,
        slug,
        title: dto.title,
        description: dto.description,
        amount: new Prisma.Decimal(dto.amount),
        currencyCode: dto.currencyCode,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async listPaymentLinks(userId: string) {
    const account = await this.requireAccount(userId);
    return this.prisma.paymentLink.findMany({ where: { merchantId: account.id }, orderBy: { createdAt: 'desc' } });
  }

  async deactivatePaymentLink(userId: string, linkId: string) {
    const account = await this.requireAccount(userId);
    const link = await this.prisma.paymentLink.findUnique({ where: { id: linkId } });
    if (!link || link.merchantId !== account.id) throw new NotFoundException('Payment link not found');
    return this.prisma.paymentLink.update({ where: { id: linkId }, data: { isActive: false } });
  }

  async getPublicPaymentLink(slug: string) {
    const link = await this.prisma.paymentLink.findUnique({
      where: { slug },
      include: { merchant: { select: { businessName: true } } },
    });
    if (!link || !link.isActive || (link.expiresAt && link.expiresAt < new Date())) {
      throw new NotFoundException('This payment link is not available');
    }
    return link;
  }

  // ---------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------

  async createInvoice(userId: string, dto: CreateInvoiceDto) {
    const account = await this.requireAccount(userId);

    return this.prisma.invoice.create({
      data: {
        merchantId: account.id,
        reference: generateReference('INV'),
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        amount: new Prisma.Decimal(dto.amount),
        currencyCode: dto.currencyCode,
        items: dto.items as unknown as Prisma.InputJsonValue,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: InvoiceStatus.SENT,
      },
    });
  }

  async listInvoices(userId: string) {
    const account = await this.requireAccount(userId);
    return this.prisma.invoice.findMany({ where: { merchantId: account.id }, orderBy: { createdAt: 'desc' } });
  }

  async voidInvoice(userId: string, invoiceId: string) {
    const account = await this.requireAccount(userId);
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.merchantId !== account.id) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('A paid invoice cannot be voided');
    return this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: InvoiceStatus.VOID } });
  }

  async getPublicInvoice(reference: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { reference },
      include: { merchant: { select: { businessName: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ---------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------

  async createCheckoutSession(params: { paymentLinkSlug?: string; invoiceReference?: string }) {
    if (params.paymentLinkSlug) {
      const link = await this.getPublicPaymentLink(params.paymentLinkSlug);
      return this.prisma.checkoutSession.create({
        data: {
          reference: generateReference('CHK'),
          merchantId: link.merchantId,
          paymentLinkId: link.id,
          amount: link.amount,
          currencyCode: link.currencyCode,
        },
      });
    }

    if (params.invoiceReference) {
      const invoice = await this.getPublicInvoice(params.invoiceReference);
      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('This invoice has already been paid');
      }
      return this.prisma.checkoutSession.create({
        data: {
          reference: generateReference('CHK'),
          merchantId: invoice.merchantId,
          invoiceId: invoice.id,
          amount: invoice.amount,
          currencyCode: invoice.currencyCode,
        },
      });
    }

    throw new BadRequestException('A payment link or invoice reference is required');
  }

  async getCheckoutSession(reference: string) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { reference },
      include: { merchant: { select: { businessName: true } } },
    });
    if (!session) throw new NotFoundException('Checkout session not found');
    return session;
  }

  async payCheckoutSession(payerId: string, reference: string, dto: PayCheckoutDto) {
    await this.auth.verifyPin(payerId, dto.pin);

    const session = await this.prisma.checkoutSession.findUnique({ where: { reference } });
    if (!session) throw new NotFoundException('Checkout session not found');
    if (session.status !== CheckoutSessionStatus.PENDING) {
      throw new BadRequestException('This checkout session is no longer payable');
    }

    const payerWallet = await this.wallets.getOne(payerId, dto.payerWalletId);
    if (payerWallet.currency.code !== session.currencyCode) {
      throw new BadRequestException(`This checkout requires payment in ${session.currencyCode}`);
    }

    const merchant = await this.prisma.merchantAccount.findUniqueOrThrow({ where: { id: session.merchantId } });

    const completed = await this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: payerWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: session.amount,
        reference: `${session.reference}-PAY`,
        description: `Checkout payment — ${merchant.businessName}`,
      });
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: merchant.walletId,
        type: LedgerEntryType.CREDIT,
        amount: session.amount,
        reference: `${session.reference}-SETTLE`,
        description: `Checkout proceeds`,
      });

      const updated = await tx.checkoutSession.update({
        where: { id: session.id },
        data: { status: CheckoutSessionStatus.COMPLETED, payerUserId: payerId, completedAt: new Date() },
      });

      if (session.invoiceId) {
        await tx.invoice.update({ where: { id: session.invoiceId }, data: { status: InvoiceStatus.PAID, paidAt: new Date() } });
      }

      return updated;
    });

    await this.dispatchWebhook(merchant.id, 'checkout.completed', {
      reference: completed.reference,
      amount: completed.amount.toString(),
      currencyCode: completed.currencyCode,
    });

    return completed;
  }

  // ---------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------

  async getDashboardSummary(userId: string) {
    const account = await this.requireAccount(userId);
    const wallet = await this.prisma.wallet.findUnique({ where: { id: account.walletId }, include: { currency: true } });

    const completedSessions = await this.prisma.checkoutSession.findMany({
      where: { merchantId: account.id, status: CheckoutSessionStatus.COMPLETED },
    });

    const totalRevenue = completedSessions.reduce((sum, s) => sum.plus(s.amount), new Prisma.Decimal(0));
    const [linkCount, invoiceCount] = await Promise.all([
      this.prisma.paymentLink.count({ where: { merchantId: account.id } }),
      this.prisma.invoice.count({ where: { merchantId: account.id } }),
    ]);

    return {
      businessName: account.businessName,
      settlementBalance: wallet?.balance ?? new Prisma.Decimal(0),
      settlementCurrency: wallet?.currency.code,
      totalRevenue,
      completedTransactions: completedSessions.length,
      paymentLinkCount: linkCount,
      invoiceCount,
    };
  }

  // ---------------------------------------------------------------------
  // Webhooks — best-effort, fire-and-forget, no retry queue in this build
  // ---------------------------------------------------------------------

  private async dispatchWebhook(merchantId: string, event: string, payload: Record<string, unknown>) {
    const merchant = await this.prisma.merchantAccount.findUnique({ where: { id: merchantId } });
    if (!merchant?.webhookUrl) return;

    let status: WebhookDeliveryStatus = WebhookDeliveryStatus.FAILED;
    let httpStatus: number | undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(merchant.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data: payload }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      httpStatus = response.status;
      status = response.ok ? WebhookDeliveryStatus.DELIVERED : WebhookDeliveryStatus.FAILED;
    } catch {
      status = WebhookDeliveryStatus.FAILED;
    }

    await this.prisma.webhookDelivery.create({
  data: {
    merchantId,
    event,
    payload: payload as Prisma.InputJsonValue,
    status,
    httpStatus,
  },
});
  }

  async listWebhookDeliveries(userId: string) {
    const account = await this.requireAccount(userId);
    return this.prisma.webhookDelivery.findMany({ where: { merchantId: account.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
