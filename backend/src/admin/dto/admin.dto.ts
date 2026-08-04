import { IsBoolean, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpsertFeatureFlagDto {
  @IsString()
  key!: string;

  @IsBoolean()
  isEnabled!: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateExchangeRateDto {
  @IsString()
  base!: string;

  @IsString()
  quote!: string;

  @IsNumberString()
  rate!: string;
}
