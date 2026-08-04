import { IsEnum } from 'class-validator';
import { KycDocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(KycDocumentType)
  type!: KycDocumentType;
}
