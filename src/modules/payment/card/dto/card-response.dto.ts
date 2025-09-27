import { ApiProperty } from '@nestjs/swagger';

export class CardResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cardholder_name: string;

  @ApiProperty()
  last_four: string;

  @ApiProperty()
  expiration_date: string;

  @ApiProperty()
  card_type: string;

  @ApiProperty()
  is_default: boolean;

  @ApiProperty()
  is_expired: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}



