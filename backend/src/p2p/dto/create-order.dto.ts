import { IsNumberString, IsString, Length } from 'class-validator';

export class CreateOrderDto {
  @IsNumberString()
  quantity!: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
