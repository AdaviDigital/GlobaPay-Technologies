import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KycService } from './kyc.service';
import { SubmitTier1Dto } from './dto/submit-tier1.dto';
import { SubmitTier2Dto } from './dto/submit-tier2.dto';
import { SubmitTier3Dto } from './dto/submit-tier3.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'kyc');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

const uploadInterceptorOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestException('Only JPEG, PNG, WebP, or PDF files are accepted'), false);
      return;
    }
    callback(null, true);
  },
};

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @RequirePermissions('kyc:submit')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getStatus(user.id);
  }

  @Post('tier1')
  @RequirePermissions('kyc:submit')
  submitTier1(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitTier1Dto) {
    return this.kycService.submitTier1(user.id, dto);
  }

  @Post('tier2')
  @RequirePermissions('kyc:submit')
  submitTier2(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitTier2Dto) {
    return this.kycService.submitTier2(user.id, dto);
  }

  @Post('tier3')
  @RequirePermissions('kyc:submit')
  submitTier3(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitTier3Dto) {
    return this.kycService.submitTier3(user.id, dto);
  }

  @Post('submissions/:id/documents')
  @RequirePermissions('kyc:submit')
  @UseInterceptors(FileInterceptor('file', uploadInterceptorOptions))
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') submissionId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.kycService.addDocument(user.id, submissionId, dto.type, file);
  }

  @Post('submissions/:id/finalize')
  @RequirePermissions('kyc:submit')
  finalize(@CurrentUser() user: AuthenticatedUser, @Param('id') submissionId: string) {
    return this.kycService.finalize(user.id, submissionId);
  }

  @Delete('documents/:id')
  @RequirePermissions('kyc:submit')
  removeDocument(@CurrentUser() user: AuthenticatedUser, @Param('id') documentId: string) {
    return this.kycService.removeDocument(user.id, documentId);
  }

  // No @RequirePermissions here on purpose: both the document's owner (an
  // ordinary kyc:submit user) and a kyc:review compliance officer need this
  // route, and RequirePermissions checks "has ALL of", not "has ANY of" — so
  // access is enforced inside getDocumentForAccess (ownership OR reviewer)
  // instead of at the guard.
  @Get('documents/:id/file')
  async downloadDocument(@CurrentUser() user: AuthenticatedUser, @Param('id') documentId: string) {
    const isReviewer = user.permissions.includes('kyc:review') || user.permissions.includes('admin:full_access');
    const document = await this.kycService.getDocumentForAccess(user.id, documentId, isReviewer);
    return new StreamableFile(createReadStream(document.storagePath), {
      type: document.mimeType,
      disposition: `inline; filename="${document.fileName}"`,
    });
  }
}
