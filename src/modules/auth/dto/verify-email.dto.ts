import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @ApiProperty({ description: 'OTP (One-Time Password) for email verification' })
  otp: string;
}
