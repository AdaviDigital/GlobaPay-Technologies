import { IsEnum, IsUUID } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class ResendOtpDto {
  @IsUUID()
  userId!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}
