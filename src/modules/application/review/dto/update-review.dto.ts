import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiProperty({
    description: 'Updated rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 4,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({
    description: 'Updated review comment or note',
    example: 'Updated review: Still great work!',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
