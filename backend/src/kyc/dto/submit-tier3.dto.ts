import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DirectorDto {
  @IsString()
  fullName!: string;

  @IsString()
  role!: string;

  @IsString()
  idNumber!: string;
}

export class SubmitTier3Dto {
  @IsString()
  businessName!: string;

  @IsString()
  registrationNumber!: string; // CAC number

  @IsString()
  taxId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectorDto)
  directors?: DirectorDto[];
}
