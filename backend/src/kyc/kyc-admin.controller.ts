import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { KycSubmissionStatus } from '@prisma/client';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KycService } from './kyc.service';
import { ReviewSubmissionDto } from './dto/review-submission.dto';

@Controller('compliance/kyc')
@RequirePermissions('kyc:review')
export class KycAdminController {
  constructor(private readonly kycService: KycService) {}

  @Get('queue')
  listQueue(@Query('status') status?: KycSubmissionStatus) {
    return this.kycService.listQueue(status);
  }

  @Get('submissions/:id')
  getSubmission(@Param('id') id: string) {
    return this.kycService.getSubmissionForReview(id);
  }

  @Patch('submissions/:id/review')
  review(@CurrentUser() reviewer: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewSubmissionDto) {
    return this.kycService.review(reviewer.id, id, dto);
  }
}
