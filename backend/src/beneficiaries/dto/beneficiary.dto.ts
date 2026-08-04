import { IsBoolean, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { BeneficiaryType } from '@prisma/client';

export class CreateBeneficiaryDto {
  @IsEnum(BeneficiaryType)
  type!: BeneficiaryType;

  @IsString()
  label!: string;

  @ValidateIf((dto) => dto.type === BeneficiaryType.GLOBAPAY_USER)
  @IsString()
  beneficiaryTag?: string; // the recipient's email or phone

  @ValidateIf((dto) => dto.type === BeneficiaryType.BANK_ACCOUNT)
  @IsString()
  bankName?: string;

  @ValidateIf((dto) => dto.type === BeneficiaryType.BANK_ACCOUNT)
  @IsString()
  accountNumber?: string;

  @ValidateIf((dto) => dto.type === BeneficiaryType.BANK_ACCOUNT)
  @IsString()
  accountName?: string;

  @ValidateIf((dto) => dto.type === BeneficiaryType.BANK_ACCOUNT)
  @IsString()
  bankCountry?: string;

  @ValidateIf((dto) => dto.type === BeneficiaryType.BANK_ACCOUNT)
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  swiftBic?: string;

  @IsOptional()
  @IsString()
  routingNumber?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  sortCode?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class UpdateBeneficiaryDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
