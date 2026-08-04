import { IsString, Length } from 'class-validator';

export class SubmitTier1Dto {
  @IsString()
  @Length(11, 11, { message: 'BVN must be 11 digits' })
  bvn!: string;

  @IsString()
  @Length(11, 11, { message: 'NIN must be 11 digits' })
  nin!: string;
}
