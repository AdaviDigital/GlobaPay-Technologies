import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { AlertDirection } from '@prisma/client';

export class CreateAlertDto {
  @IsString()
  currencyCode!: string;

  @IsOptional()
  @IsString()
  quoteCurrencyCode?: string;

  @IsEnum(AlertDirection)
  direction!: AlertDirection;

  @IsNumberString()
  targetPrice!: string;
}
