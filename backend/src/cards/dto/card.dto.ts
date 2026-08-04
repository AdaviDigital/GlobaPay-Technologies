import { IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class IssueCardDto {
  @IsUUID()
  walletId!: string;

  @IsString()
  label!: string;

  @IsIn(['VERVE', 'MASTERCARD'])
  brand!: 'VERVE' | 'MASTERCARD';
}

export class SetCardLimitDto {
  @IsNumberString()
  amount!: string;

  @IsIn(['DAILY', 'MONTHLY'])
  period!: 'DAILY' | 'MONTHLY';
}

export class SimulatePurchaseDto {
  @IsNumberString()
  amount!: string;

  @IsString()
  merchantName!: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}
