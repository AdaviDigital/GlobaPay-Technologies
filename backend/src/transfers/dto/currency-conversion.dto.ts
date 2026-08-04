import { IsNumberString, IsString, IsUUID, Length } from 'class-validator';

export class CurrencyConversionDto {
  @IsUUID()
  sourceWalletId!: string;

  @IsString()
  destinationCurrencyCode!: string;

  @IsNumberString()
  amount!: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
