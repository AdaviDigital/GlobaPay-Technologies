import { IsEnum, IsString, IsUUID, Length } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class VerifyOtpDto {
  @IsUUID()
  userId!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsString()
  @Length(6, 6)
  code!: string;
}
