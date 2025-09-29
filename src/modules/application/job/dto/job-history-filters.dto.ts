import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsArray, IsEnum, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export enum SortBy {
  NEAREST = 'nearest',
  RATING = 'rating',
  PRICE_LOW_HIGH = 'price_low_high',
  PRICE_HIGH_LOW = 'price_high_low',
  DATE_NEWEST = 'date_newest',
  DATE_OLDEST = 'date_oldest'
}

export enum JobStatus {
  POSTED = 'posted',
  COUNTER_OFFER = 'counter_offer',
  CONFIRMED = 'confirmed',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  PAID = 'paid'
}

export enum JobType {
  TECHNOLOGY = 'Technology',
  PHOTOGRAPHY = 'Photography',
  DESIGN = 'Design',
  WRITING = 'Writing',
  MARKETING = 'Marketing',
  CONSULTING = 'Consulting',
  OTHER = 'Other'
}

export class JobHistoryFiltersDto {
  @ApiProperty({ 
    description: 'User ID for filtering user jobs', 
    example: 'user123',
    required: false 
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ 
    description: 'Helper ID for filtering helper jobs', 
    example: 'helper123',
    required: false 
  })
  @IsOptional()
  @IsString()
  helperId?: string;

  @ApiProperty({ 
    description: 'Job status filter (comma-separated)', 
    example: 'posted,confirmed,completed',
    required: false 
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? value.split(',').map(s => s.trim()) : [])
  status?: string[];

  @ApiProperty({ 
    description: 'Job type filter (comma-separated)', 
    example: 'Technology,Photography,Design',
    required: false 
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? value.split(',').map(t => t.trim()) : [])
  jobType?: string[];

  @ApiProperty({ 
    description: 'Minimum price filter', 
    example: 100,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  minPrice?: number;

  @ApiProperty({ 
    description: 'Maximum price filter', 
    example: 1000,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  maxPrice?: number;

  @ApiProperty({ 
    description: 'Sort by field', 
    enum: SortBy,
    example: SortBy.DATE_NEWEST,
    required: false 
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @ApiProperty({ 
    description: 'User latitude for distance filtering', 
    example: 40.7128,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  userLatitude?: number;

  @ApiProperty({ 
    description: 'User longitude for distance filtering', 
    example: -74.0060,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  userLongitude?: number;

  @ApiProperty({ 
    description: 'Maximum distance in kilometers', 
    example: 50,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => value ? parseFloat(value) : 50)
  maxDistanceKm?: number;

  @ApiProperty({ 
    description: 'Page number', 
    example: 1,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : 1)
  page?: number;

  @ApiProperty({ 
    description: 'Items per page', 
    example: 10,
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => value ? parseInt(value) : 10)
  limit?: number;
}

export class JobHistoryResponseDto {
  @ApiProperty({ description: 'Array of jobs' })
  jobs: any[];

  @ApiProperty({ description: 'Total number of jobs' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

export class JobHistoryApiResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Job history data', type: JobHistoryResponseDto })
  data: JobHistoryResponseDto;
}


