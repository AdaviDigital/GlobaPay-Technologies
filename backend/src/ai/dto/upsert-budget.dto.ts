import { IsNumberString, IsString } from 'class-validator';

export class UpsertBudgetDto {
  @IsString()
  category!: string;

  @IsString()
  currencyCode!: string;

  @IsNumberString()
  monthlyLimit!: string;
}
