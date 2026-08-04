import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DisputeResolution } from '@prisma/client';

export class RaiseDisputeDto {
  @IsString()
  reason!: string;
}

export class ResolveDisputeDto {
  @IsEnum(DisputeResolution)
  resolution!: DisputeResolution;

  @IsOptional()
  @IsString()
  note?: string;
}
