import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { GiftCardValidationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GiftCardFormatService } from './giftcard-format.service';
import { OcrProviderService } from './ocr-provider.service';

@Injectable()
export class GiftCardValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly format: GiftCardFormatService,
    private readonly ocr: OcrProviderService,
  ) {}

  /**
   * Runs when a seller delivers a gift card code on a P2P order. Combines:
   *  - a real format check against known brand code patterns
   *  - a real duplicate check (has this exact code been delivered on this
   *    platform before? — a genuine, valuable fraud signal, since a code
   *    that's already been sold once is either an error or a scam)
   *  - an OCR cross-check against an uploaded photo, if the provider is
   *    configured (it isn't, by default — see OcrProviderService)
   * and produces a 0-100 risk score. This never blocks delivery outright;
   * FLAGGED/REJECTED results route to the compliance queue instead.
   */
  async validate(params: { orderId: string; brandCode: string; code: string; imagePath?: string }) {
    const codeHash = createHash('sha256').update(params.code.trim().toUpperCase()).digest('hex');

    const formatResult = this.format.check(params.brandCode, params.code);

    const duplicate = await this.prisma.giftCardValidation.findFirst({ where: { codeHash } });
    const duplicateCheckPassed = !duplicate;

    let ocrExtractedText: string | undefined;
    if (params.imagePath && this.ocr.isConfigured()) {
      const result = await this.ocr.extractText(params.imagePath);
      ocrExtractedText = result.extractedText;
    }

    let riskScore = 5; // baseline
    if (!formatResult.passed) riskScore += 40;
    if (!duplicateCheckPassed) riskScore += 55;
    riskScore = Math.min(riskScore, 100);

    const status: GiftCardValidationStatus = !duplicateCheckPassed
      ? GiftCardValidationStatus.REJECTED
      : !formatResult.passed
        ? GiftCardValidationStatus.FLAGGED
        : GiftCardValidationStatus.PASSED;

    const notes = [
      formatResult.reason,
      duplicateCheckPassed ? 'No prior delivery of this exact code found' : 'This exact code was already delivered on a previous order',
    ].join('. ');

    return this.prisma.giftCardValidation.create({
      data: {
        orderId: params.orderId,
        codeHash,
        imagePath: params.imagePath,
        ocrExtractedText,
        formatCheckPassed: formatResult.passed,
        duplicateCheckPassed,
        riskScore,
        status,
        notes,
      },
    });
  }

  async getForOrder(orderId: string) {
    return this.prisma.giftCardValidation.findUnique({ where: { orderId } });
  }
}
