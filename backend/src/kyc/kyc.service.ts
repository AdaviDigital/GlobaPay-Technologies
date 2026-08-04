import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import {
  KycDocumentType,
  KycSubmissionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScreeningService } from './screening.service';
import { SubmitTier1Dto } from './dto/submit-tier1.dto';
import { SubmitTier2Dto } from './dto/submit-tier2.dto';
import { SubmitTier3Dto } from './dto/submit-tier3.dto';
import { ReviewDecision, ReviewSubmissionDto } from './dto/review-submission.dto';
import { AuditLogService } from '../admin/audit-log.service';

const REQUIRED_DOCS_BY_TIER: Record<number, { anyOf: KycDocumentType[] }[]> = {
  1: [{ anyOf: [KycDocumentType.SELFIE] }],
  2: [
    { anyOf: [KycDocumentType.PASSPORT, KycDocumentType.DRIVERS_LICENSE, KycDocumentType.NATIONAL_ID] },
    { anyOf: [KycDocumentType.PROOF_OF_ADDRESS] },
  ],
  3: [{ anyOf: [KycDocumentType.CAC_CERTIFICATE] }, { anyOf: [KycDocumentType.TAX_ID_DOCUMENT] }],
};

const OPEN_STATUSES: KycSubmissionStatus[] = [
  KycSubmissionStatus.PENDING,
  KycSubmissionStatus.IN_REVIEW,
  KycSubmissionStatus.NEEDS_MORE_INFO,
];

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly screening: ScreeningService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const submissions = await this.prisma.kycSubmission.findMany({
      where: { userId },
      include: { documents: true },
      orderBy: { submittedAt: 'desc' },
    });
    return { currentTier: user.kycTier, submissions };
  }

  private async assertCanSubmit(userId: string, targetTier: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.kycTier >= targetTier) {
      throw new BadRequestException(`You are already verified at tier ${targetTier} or higher`);
    }
    if (targetTier > user.kycTier + 1) {
      throw new BadRequestException(`Complete tier ${user.kycTier + 1} verification before tier ${targetTier}`);
    }

    const existingOpen = await this.prisma.kycSubmission.findFirst({
      where: { userId, targetTier, status: { in: OPEN_STATUSES } },
    });
    if (existingOpen) {
      throw new BadRequestException(`You already have a tier ${targetTier} submission in progress`);
    }
  }

  async submitTier1(userId: string, dto: SubmitTier1Dto) {
    await this.assertCanSubmit(userId, 1);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const screening = this.screening.screenIndividual(`${user.firstName} ${user.lastName}`, user.country);

    return this.prisma.kycSubmission.create({
      data: {
        userId,
        targetTier: 1,
        bvn: dto.bvn,
        nin: dto.nin,
        riskScore: screening.riskScore,
        amlFlag: screening.amlFlag,
        sanctionsFlag: screening.sanctionsFlag,
        pepFlag: screening.pepFlag,
        screeningNotes: screening.notes,
      },
    });
  }

  async submitTier2(userId: string, dto: SubmitTier2Dto) {
    await this.assertCanSubmit(userId, 2);

    return this.prisma.kycSubmission.create({
      data: { userId, targetTier: 2, ...dto },
    });
  }

  async submitTier3(userId: string, dto: SubmitTier3Dto) {
    await this.assertCanSubmit(userId, 3);

    const screening = this.screening.screenBusiness(dto.businessName);

    return this.prisma.kycSubmission.create({
      data: {
        userId,
        targetTier: 3,
        businessName: dto.businessName,
        registrationNumber: dto.registrationNumber,
        taxId: dto.taxId,
        directors: dto.directors as unknown as Prisma.InputJsonValue,
        riskScore: screening.riskScore,
        amlFlag: screening.amlFlag,
        sanctionsFlag: screening.sanctionsFlag,
        pepFlag: screening.pepFlag,
        screeningNotes: screening.notes,
      },
    });
  }

  private async getOwnedSubmission(userId: string, submissionId: string) {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id: submissionId },
      include: { documents: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.userId !== userId) throw new ForbiddenException('This submission does not belong to you');
    return submission;
  }

  async addDocument(
    userId: string,
    submissionId: string,
    type: KycDocumentType,
    file: { originalname: string; path: string; mimetype: string; size: number },
  ) {
    const submission = await this.getOwnedSubmission(userId, submissionId);
    if (!OPEN_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This submission is no longer accepting documents');
    }

    return this.prisma.kycDocument.create({
      data: {
        submissionId: submission.id,
        type,
        fileName: file.originalname,
        storagePath: file.path,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
      },
    });
  }

  private hasRequiredDocuments(targetTier: number, documentTypes: KycDocumentType[]): boolean {
    const requirements = REQUIRED_DOCS_BY_TIER[targetTier] ?? [];
    return requirements.every((req) => req.anyOf.some((type) => documentTypes.includes(type)));
  }

  /**
   * Finalizes a submission once the user has uploaded what they intend to:
   * requires the tier's minimum documents, then either straight-through
   * approves (clean screening result) or routes to the compliance queue.
   */
  async finalize(userId: string, submissionId: string) {
    const submission = await this.getOwnedSubmission(userId, submissionId);
    if (!OPEN_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This submission has already been finalized');
    }

    const documentTypes = submission.documents.map((d) => d.type);
    if (!this.hasRequiredDocuments(submission.targetTier, documentTypes)) {
      throw new BadRequestException('Required documents are missing for this tier');
    }

    const isClean = !submission.amlFlag && !submission.sanctionsFlag && !submission.pepFlag;

    if (isClean) {
      return this.approve(submission.id, null, 'Auto-approved: clean automated screening result');
    }

    return this.prisma.kycSubmission.update({
      where: { id: submission.id },
      data: { status: KycSubmissionStatus.IN_REVIEW },
    });
  }

  // ---------------------------------------------------------------------
  // Compliance review queue
  // ---------------------------------------------------------------------

  async listQueue(status?: KycSubmissionStatus) {
    return this.prisma.kycSubmission.findMany({
      where: status ? { status } : { status: { in: [KycSubmissionStatus.IN_REVIEW, KycSubmissionStatus.PENDING] } },
      include: { documents: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async getSubmissionForReview(submissionId: string) {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id: submissionId },
      include: { documents: true, user: { select: { id: true, firstName: true, lastName: true, email: true, kycTier: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async review(reviewerId: string, submissionId: string, dto: ReviewSubmissionDto) {
    const submission = await this.prisma.kycSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (!OPEN_STATUSES.includes(submission.status)) {
      throw new BadRequestException('This submission has already been finalized');
    }

    this.auditLog.record({
      userId: reviewerId,
      action: `kyc.review.${dto.decision.toLowerCase()}`,
      entity: 'KycSubmission',
      entityId: submissionId,
      metadata: { targetUserId: submission.userId, targetTier: submission.targetTier, note: dto.note },
    });

    if (dto.decision === ReviewDecision.APPROVE) {
      return this.approve(submission.id, reviewerId, dto.note);
    }

    const status = dto.decision === ReviewDecision.REJECT ? KycSubmissionStatus.REJECTED : KycSubmissionStatus.NEEDS_MORE_INFO;

    return this.prisma.kycSubmission.update({
      where: { id: submission.id },
      data: { status, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: dto.note },
    });
  }

  private async approve(submissionId: string, reviewerId: string | null, note?: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: KycSubmissionStatus.APPROVED,
          reviewedById: reviewerId ?? undefined,
          reviewedAt: new Date(),
          reviewNote: note ?? undefined,
        },
      });

      await tx.user.update({
        where: { id: submission.userId },
        data: { kycTier: submission.targetTier },
      });

      return submission;
    });
  }

  // ---------------------------------------------------------------------
  // Document file access
  // ---------------------------------------------------------------------

  /** Returns the document if the requester owns it or is a compliance reviewer, else throws. */
  async getDocumentForAccess(userId: string, documentId: string, isReviewer: boolean) {
    const document = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      include: { submission: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (document.submission.userId !== userId && !isReviewer) {
      throw new ForbiddenException('You do not have access to this document');
    }
    return document;
  }

  /** Used when the user withdraws a document before finalizing (cleans up disk too). */
  async removeDocument(userId: string, documentId: string) {
    const document = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      include: { submission: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (document.submission.userId !== userId) throw new ForbiddenException('This document does not belong to you');
    if (!OPEN_STATUSES.includes(document.submission.status)) {
      throw new BadRequestException('This submission has already been finalized');
    }

    await this.prisma.kycDocument.delete({ where: { id: documentId } });
    await unlink(document.storagePath).catch(() => undefined);
    return { deleted: true };
  }
}
