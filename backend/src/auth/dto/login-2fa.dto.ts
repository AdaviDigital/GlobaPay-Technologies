import { IsString, IsUUID, Length } from 'class-validator';

export class Login2faDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  loginToken!: string;
}
