import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { RecurrenceFrequency, TransferRail } from '@prisma/client';

export class BankTransferDto {
  @IsUUID()
  sourceWalletId!: string;

  @IsUUID()
  beneficiaryId!: string; // must be a saved BANK_ACCOUNT beneficiary

  @IsEnum(TransferRail)
  rail!: TransferRail; // LOCAL_INSTANT, SWIFT, ACH, SEPA, FASTER_PAYMENTS

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @IsOptional()
  @IsDateString()
  recurrenceEndsAt?: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
