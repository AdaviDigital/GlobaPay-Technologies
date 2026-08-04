import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  DisputeResolution,
  LedgerEntryType,
  P2PAssetType,
  P2POfferStatus,
  P2POrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuthService } from '../auth/auth.service';
import { GiftCardValidationService } from '../giftcards/giftcard-validation.service';
import { AuditLogService } from '../admin/audit-log.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ResolveDisputeDto } from './dto/dispute.dto';
import { CreateReviewDto } from './dto/create-review.dto';

const GIFT_CARD_DELIVERY_DEADLINE_HOURS = 24;

function generateReference(): string {
  return `P2P-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class P2pService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly auth: AuthService,
    private readonly giftCardValidation: GiftCardValidationService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------
  // Offers
  // ---------------------------------------------------------------------

  async createOffer(sellerId: string, dto: CreateOfferDto) {
    const min = new Prisma.Decimal(dto.minOrderQuantity);
    const max = new Prisma.Decimal(dto.maxOrderQuantity);
    const available = new Prisma.Decimal(dto.availableQuantity);

    if (min.lessThanOrEqualTo(0) || max.lessThan(min) || available.lessThan(min)) {
      throw new BadRequestException('Invalid quantity range');
    }

    return this.prisma.p2POffer.create({
      data: {
        sellerId,
        assetType: dto.assetType,
        assetCode: dto.assetCode,
        quoteCurrencyCode: dto.quoteCurrencyCode,
        pricePerUnit: new Prisma.Decimal(dto.pricePerUnit),
        availableQuantity: available,
        minOrderQuantity: min,
        maxOrderQuantity: max,
        terms: dto.terms,
      },
    });
  }

  async listOffers(filters: { assetType?: P2PAssetType; assetCode?: string }) {
    return this.prisma.p2POffer.findMany({
      where: {
        status: P2POfferStatus.ACTIVE,
        assetType: filters.assetType,
        assetCode: filters.assetCode,
        availableQuantity: { gt: 0 },
      },
      include: { seller: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { pricePerUnit: 'asc' },
    });
  }

  async listMyOffers(sellerId: string) {
    return this.prisma.p2POffer.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' } });
  }

  async setOfferStatus(sellerId: string, offerId: string, status: P2POfferStatus) {
    const offer = await this.prisma.p2POffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.sellerId !== sellerId) throw new ForbiddenException('This offer does not belong to you');
    return this.prisma.p2POffer.update({ where: { id: offerId }, data: { status } });
  }

  // ---------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------

  async createOrder(buyerId: string, offerId: string, dto: CreateOrderDto) {
    await this.auth.verifyPin(buyerId, dto.pin);

    const offer = await this.prisma.p2POffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.status !== P2POfferStatus.ACTIVE) {
      throw new NotFoundException('Offer not found or no longer active');
    }
    if (offer.sellerId === buyerId) {
      throw new BadRequestException('You cannot fulfill your own offer');
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    if (quantity.lessThan(offer.minOrderQuantity) || quantity.greaterThan(offer.maxOrderQuantity)) {
      throw new BadRequestException("Quantity is outside the offer's allowed range");
    }
    if (quantity.greaterThan(offer.availableQuantity)) {
      throw new BadRequestException('Not enough available on this offer');
    }

    const totalAmount = quantity.times(offer.pricePerUnit);
    const reference = generateReference();

    const buyerQuoteWallet = await this.wallets.getOrCreateWallet(buyerId, offer.quoteCurrencyCode);

    if (offer.assetType === P2PAssetType.CRYPTO) {
      return this.settleCryptoOrderInstantly({ offer, buyerId, buyerQuoteWallet, quantity, totalAmount, reference });
    }

    return this.holdGiftCardOrderInEscrow({ offer, buyerId, buyerQuoteWallet, quantity, totalAmount, reference });
  }

  /** Crypto: both legs are programmatically guaranteed, so settlement is instant and atomic. */
  private async settleCryptoOrderInstantly(params: {
    offer: { id: string; sellerId: string; assetCode: string; quoteCurrencyCode: string };
    buyerId: string;
    buyerQuoteWallet: { id: string };
    quantity: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    reference: string;
  }) {
    const sellerCryptoWallet = await this.wallets.getOrCreateWallet(params.offer.sellerId, params.offer.assetCode);
    const sellerQuoteWallet = await this.wallets.getOrCreateWallet(params.offer.sellerId, params.offer.quoteCurrencyCode);
    const buyerCryptoWallet = await this.wallets.getOrCreateWallet(params.buyerId, params.offer.assetCode);

    return this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: params.buyerQuoteWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: params.totalAmount,
        reference: `${params.reference}-BUYERPAY`,
        description: `P2P buy ${params.quantity} ${params.offer.assetCode}`,
      });
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: sellerCryptoWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: params.quantity,
        reference: `${params.reference}-SELLERSEND`,
        description: `P2P sell ${params.quantity} ${params.offer.assetCode}`,
      });
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: buyerCryptoWallet.id,
        type: LedgerEntryType.CREDIT,
        amount: params.quantity,
        reference: `${params.reference}-BUYERRECV`,
        description: `P2P purchase received`,
      });
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: sellerQuoteWallet.id,
        type: LedgerEntryType.CREDIT,
        amount: params.totalAmount,
        reference: `${params.reference}-SELLERRECV`,
        description: `P2P sale proceeds`,
      });

      await tx.p2POffer.update({
        where: { id: params.offer.id },
        data: { availableQuantity: { decrement: params.quantity } },
      });

      return tx.p2POrder.create({
        data: {
          reference: params.reference,
          offerId: params.offer.id,
          buyerId: params.buyerId,
          sellerId: params.offer.sellerId,
          assetType: P2PAssetType.CRYPTO,
          assetCode: params.offer.assetCode,
          quantity: params.quantity,
          pricePerUnit: params.totalAmount.dividedBy(params.quantity),
          totalAmount: params.totalAmount,
          quoteCurrencyCode: params.offer.quoteCurrencyCode,
          status: P2POrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });
  }

  /** Gift cards: buyer pays now, seller's proceeds sit frozen until delivery is confirmed (or a dispute resolves it). */
  private async holdGiftCardOrderInEscrow(params: {
    offer: { id: string; sellerId: string; assetCode: string; quoteCurrencyCode: string };
    buyerId: string;
    buyerQuoteWallet: { id: string };
    quantity: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    reference: string;
  }) {
    const sellerQuoteWallet = await this.wallets.getOrCreateWallet(params.offer.sellerId, params.offer.quoteCurrencyCode);

    return this.prisma.$transaction(async (tx) => {
      await this.wallets.applyLedgerMovementInTx(tx, {
        walletId: params.buyerQuoteWallet.id,
        type: LedgerEntryType.DEBIT,
        amount: params.totalAmount,
        reference: `${params.reference}-ESCROW`,
        description: `P2P gift card purchase (in escrow)`,
      });
      await this.wallets.holdInFrozenInTx(tx, sellerQuoteWallet.id, params.totalAmount);

      await tx.p2POffer.update({
        where: { id: params.offer.id },
        data: { availableQuantity: { decrement: params.quantity } },
      });

      return tx.p2POrder.create({
        data: {
          reference: params.reference,
          offerId: params.offer.id,
          buyerId: params.buyerId,
          sellerId: params.offer.sellerId,
          assetType: P2PAssetType.GIFT_CARD,
          assetCode: params.offer.assetCode,
          quantity: params.quantity,
          pricePerUnit: params.totalAmount.dividedBy(params.quantity),
          totalAmount: params.totalAmount,
          quoteCurrencyCode: params.offer.quoteCurrencyCode,
          status: P2POrderStatus.PENDING_DELIVERY,
        },
      });
    });
  }

  async getOwnedOrder(userId: string, orderId: string) {
    const order = await this.prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    return order;
  }

  async listOrdersForUser(userId: string) {
    return this.prisma.p2POrder.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: { review: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deliverGiftCardCode(sellerId: string, orderId: string, code: string, imagePath?: string) {
    const order = await this.getOwnedOrder(sellerId, orderId);
    if (order.sellerId !== sellerId) throw new ForbiddenException('Only the seller can deliver the code');
    if (order.status !== P2POrderStatus.PENDING_DELIVERY) {
      throw new BadRequestException('This order is not awaiting delivery');
    }

    const updated = await this.prisma.p2POrder.update({
      where: { id: orderId },
      data: { giftCardCode: code, status: P2POrderStatus.DELIVERED, deliveredAt: new Date() },
    });

    // Validation runs after delivery, not before — it never blocks the
    // seller from delivering, but a FLAGGED/REJECTED result gives the buyer
    // (and, via the dispute flow, compliance) a concrete reason to hold off
    // confirming receipt.
    await this.giftCardValidation
      .validate({ orderId, brandCode: order.assetCode, code, imagePath })
      .catch(() => undefined);

    return updated;
  }

  /** Buyer views the delivered code — separate from the general order read so we don't leak it to the seller's own view unnecessarily. */
  async getGiftCardCode(buyerId: string, orderId: string) {
    const order = await this.getOwnedOrder(buyerId, orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can view the delivered code');
    if (!order.giftCardCode) throw new BadRequestException('No code has been delivered yet');
    return { code: order.giftCardCode };
  }

  async getGiftCardValidation(userId: string, orderId: string) {
    await this.getOwnedOrder(userId, orderId); // ownership check (buyer or seller)
    return this.prisma.giftCardValidation.findUnique({ where: { orderId } });
  }

  async confirmDelivery(buyerId: string, orderId: string) {
    const order = await this.getOwnedOrder(buyerId, orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can confirm delivery');
    if (order.status !== P2POrderStatus.DELIVERED) {
      throw new BadRequestException('This order has not been delivered yet');
    }

    const sellerWallet = await this.wallets.getOrCreateWallet(order.sellerId, order.quoteCurrencyCode);

    return this.prisma.$transaction(async (tx) => {
      await this.wallets.releaseFrozenToBalanceInTx(
        tx,
        sellerWallet.id,
        order.totalAmount,
        `${order.reference}-RELEASE`,
        'P2P escrow released — buyer confirmed delivery',
      );
      return tx.p2POrder.update({
        where: { id: order.id },
        data: { status: P2POrderStatus.COMPLETED, completedAt: new Date() },
      });
    });
  }

  async raiseDispute(userId: string, orderId: string, reason: string) {
    const order = await this.getOwnedOrder(userId, orderId);
    if (
  order.status !== P2POrderStatus.PENDING_DELIVERY &&
  order.status !== P2POrderStatus.DELIVERED
) {
  throw new BadRequestException('This order cannot be disputed at its current stage');
}

    return this.prisma.p2POrder.update({
      where: { id: orderId },
      data: { status: P2POrderStatus.DISPUTED, disputeReason: reason, disputeRaisedById: userId },
    });
  }

  // ---------------------------------------------------------------------
  // Compliance/admin: dispute resolution & auto-expiry
  // ---------------------------------------------------------------------

  async listDisputes() {
    return this.prisma.p2POrder.findMany({
      where: { status: P2POrderStatus.DISPUTED },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true } },
        seller: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveDispute(resolverId: string, orderId: string, dto: ResolveDisputeDto) {
    const order = await this.prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== P2POrderStatus.DISPUTED) {
      throw new BadRequestException('This order is not under dispute');
    }

    const sellerWallet = await this.wallets.getOrCreateWallet(order.sellerId, order.quoteCurrencyCode);

    this.auditLog.record({
      userId: resolverId,
      action: `p2p.dispute.resolved_${dto.resolution.toLowerCase()}`,
      entity: 'P2POrder',
      entityId: orderId,
      metadata: { note: dto.note, buyerId: order.buyerId, sellerId: order.sellerId },
    });

    return this.prisma.$transaction(async (tx) => {
      if (dto.resolution === DisputeResolution.SELLER) {
        await this.wallets.releaseFrozenToBalanceInTx(
          tx,
          sellerWallet.id,
          order.totalAmount,
          `${order.reference}-DISPUTE-SELLER`,
          'P2P dispute resolved in favor of the seller',
        );
      } else {
        await this.wallets.releaseFrozenOnlyInTx(tx, sellerWallet.id, order.totalAmount);
        const buyerWallet = await this.wallets.getOrCreateWallet(order.buyerId, order.quoteCurrencyCode);
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: buyerWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: order.totalAmount,
          reference: `${order.reference}-DISPUTE-BUYER`,
          description: 'P2P dispute resolved in favor of the buyer — refunded',
        });
      }

      return tx.p2POrder.update({
        where: { id: order.id },
        data: {
          status: P2POrderStatus.CANCELLED,
          disputeResolution: dto.resolution,
          disputeNote: dto.note,
          disputeResolvedById: resolverId,
          disputeResolvedAt: new Date(),
          cancelledAt: new Date(),
        },
      });
    });
  }

  /** Runs on a cron tick: refunds buyers whose gift-card orders the seller never delivered in time. */
  async expireOverdueDeliveries() {
    const deadline = new Date(Date.now() - GIFT_CARD_DELIVERY_DEADLINE_HOURS * 60 * 60 * 1000);
    const overdue = await this.prisma.p2POrder.findMany({
      where: { status: P2POrderStatus.PENDING_DELIVERY, createdAt: { lt: deadline } },
    });

    for (const order of overdue) {
      const sellerWallet = await this.wallets.getOrCreateWallet(order.sellerId, order.quoteCurrencyCode);
      const buyerWallet = await this.wallets.getOrCreateWallet(order.buyerId, order.quoteCurrencyCode);

      await this.prisma.$transaction(async (tx) => {
        await this.wallets.releaseFrozenOnlyInTx(tx, sellerWallet.id, order.totalAmount);
        await this.wallets.applyLedgerMovementInTx(tx, {
          walletId: buyerWallet.id,
          type: LedgerEntryType.CREDIT,
          amount: order.totalAmount,
          reference: `${order.reference}-AUTOREFUND`,
          description: 'P2P order auto-cancelled — seller did not deliver in time',
        });
        await tx.p2POrder.update({
          where: { id: order.id },
          data: { status: P2POrderStatus.CANCELLED, cancelledAt: new Date() },
        });
        await tx.p2POffer.update({
          where: { id: order.offerId },
          data: { availableQuantity: { increment: order.quantity } },
        });
      });
    }
  }

  // ---------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------

  async createReview(reviewerId: string, orderId: string, dto: CreateReviewDto) {
    const order = await this.getOwnedOrder(reviewerId, orderId);
    if (order.status !== P2POrderStatus.COMPLETED) {
      throw new BadRequestException('You can only review completed orders');
    }

    const revieweeId = order.buyerId === reviewerId ? order.sellerId : order.buyerId;

    return this.prisma.p2PReview.create({
      data: { orderId, reviewerId, revieweeId, rating: dto.rating, comment: dto.comment },
    });
  }

  async getReputation(userId: string) {
    const reviews = await this.prisma.p2PReview.findMany({ where: { revieweeId: userId } });
    const count = reviews.length;
    const average = count === 0 ? null : reviews.reduce((sum, r) => sum + r.rating, 0) / count;
    return { averageRating: average, reviewCount: count };
  }
}
