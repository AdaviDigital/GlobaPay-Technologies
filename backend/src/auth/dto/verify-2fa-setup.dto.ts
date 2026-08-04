import { IsString, Length } from 'class-validator';

export class Verify2faSetupDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
