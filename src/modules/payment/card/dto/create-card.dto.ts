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
    description: 'Card number (16 digits)',
    example: '4111111111111111',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{16}$/, { message: 'Card number must be exactly 16 digits' })
  card_number: string;

  @ApiProperty({
    description: 'Expiration date in MM/YY format',
    example: '12/25',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'Expiration date must be in MM/YY format' })
  expiration_date: string;

  @ApiProperty({
    description: 'CVV code (3-4 digits)',
    example: '123',
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 4, { message: 'CVV must be 3 or 4 digits' })
  @Matches(/^\d{3,4}$/, { message: 'CVV must contain only digits' })
  cvv: string;

  @ApiProperty({
    description: 'Set as default card',
    example: false,
    required: false,
  })
  @IsOptional()
  is_default?: boolean;
}


