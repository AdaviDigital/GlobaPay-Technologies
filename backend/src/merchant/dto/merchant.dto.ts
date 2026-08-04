import { IsArray, IsEmail, IsNumberString, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMerchantAccountDto {
  @IsString()
  businessName!: string;

  @IsString()
  walletId!: string; // an existing fiat wallet to receive settlement

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;
}

export class CreatePaymentLinkDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumberString()
  amount!: string;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  expiresAt?: string;
}

class InvoiceItemDto {
  @IsString()
  description!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitPrice!: string;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsNumberString()
  amount!: string;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional()
  dueDate?: string;
}
