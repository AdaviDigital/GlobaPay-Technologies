import { IsNumberString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class WalletToWalletDto {
  @IsUUID()
  sourceWalletId!: string;

  @IsOptional()
  @IsUUID()
  beneficiaryId?: string; // a saved GLOBAPAY_USER beneficiary

  @IsOptional()
  @IsString()
  recipientTag?: string; // email/phone, if not using a saved beneficiary

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
