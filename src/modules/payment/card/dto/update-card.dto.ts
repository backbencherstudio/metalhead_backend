import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateCardDto {
  @ApiProperty({
    description: 'Set as default card',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}



