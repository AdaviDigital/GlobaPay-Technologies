import { IsString, MinLength } from 'class-validator';

export class DeliverCodeDto {
  @IsString()
  @MinLength(4)
  code!: string;
}
