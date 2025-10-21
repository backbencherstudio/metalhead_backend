import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiProperty({
    description: 'Review comment or note',
    example: 'Great work! Very professional and completed on time.',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'ID of the job this review is for',
    example: 'clx123456789',
  })
  @IsString()
  @IsNotEmpty()
  job_id: string;
}
