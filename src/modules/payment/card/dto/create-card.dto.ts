import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, Matches, Length } from 'class-validator';

export class CreateCardDto {
  @ApiProperty({
    description: 'Cardholder name as it appears on the card',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  cardholder_name: string;

  @ApiProperty({
    description: 'Stripe token ID (created on frontend or use test tokens)',
    example: 'tok_visa',
  })
  @IsNotEmpty()
  @IsString()
  stripe_token: string;

  @ApiProperty({
    description: 'Set as default card',
    example: false,
    required: false,
  })
  @IsOptional()
  is_default?: boolean;
}













