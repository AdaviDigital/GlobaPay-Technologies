import { IsString, IsUUID, Length } from 'class-validator';

export class PayCheckoutDto {
  @IsUUID()
  payerWalletId!: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
