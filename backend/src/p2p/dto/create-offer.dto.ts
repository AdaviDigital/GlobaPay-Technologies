import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { P2PAssetType } from '@prisma/client';

export class CreateOfferDto {
  @IsEnum(P2PAssetType)
  assetType!: P2PAssetType;

  @IsString()
  assetCode!: string; // crypto code (BTC) or gift card brand key (AMAZON_USD)

  @IsString()
  quoteCurrencyCode!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsNumberString()
  availableQuantity!: string;

  @IsNumberString()
  minOrderQuantity!: string;

  @IsNumberString()
  maxOrderQuantity!: string;

  @IsOptional()
  @IsString()
  terms?: string;
}
