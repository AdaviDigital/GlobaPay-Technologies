import {
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { RoleName } from '../../common/enums/role.enum';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters long' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message:
      'Password must include upper and lower case letters, a number, and a special character',
  })
  password!: string;

  @IsOptional()
  @IsIn([RoleName.INDIVIDUAL, RoleName.BUSINESS, RoleName.MERCHANT, RoleName.DIASPORA_USER])
  accountType?: RoleName;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
