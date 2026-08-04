import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  NEEDS_MORE_INFO = 'NEEDS_MORE_INFO',
}

export class ReviewSubmissionDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @IsOptional()
  @IsString()
  note?: string;
}
