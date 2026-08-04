import { Module } from '@nestjs/common';
import { GiftCardValidationService } from './giftcard-validation.service';
import { GiftCardFormatService } from './giftcard-format.service';
import { OcrProviderService } from './ocr-provider.service';

@Module({
  providers: [GiftCardValidationService, GiftCardFormatService, OcrProviderService],
  exports: [GiftCardValidationService],
})
export class GiftCardsModule {}
