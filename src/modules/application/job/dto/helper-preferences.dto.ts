import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsArray, IsString, Min, Max, IsEnum } from 'class-validator';
import { JobCategory } from '../enums/job-category.enum';

export class UpdateHelperPreferencesDto {
  @ApiProperty({
    description: 'Maximum distance in kilometers for job notifications',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxDistanceKm?: number;

  @ApiProperty({
    description: 'Minimum job price to get notified',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minJobPrice?: number;

  @ApiProperty({
    description: 'Maximum job price to get notified',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxJobPrice?: number;

  @ApiProperty({
    description: 'Preferred job categories to get notified about',
    example: [JobCategory.CLEANING, JobCategory.HANDYMAN, JobCategory.TECHNOLOGY],
    enum: JobCategory,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(JobCategory, { each: true })
  preferredCategories?: JobCategory[];
}

