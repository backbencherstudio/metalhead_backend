import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { JobType } from '../enums/job-type.enum';
import { PaymentType } from '../enums/payment-type.enum';

export class SearchJobsDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', example: '1' })
  @IsOptional()
  @IsNumberString({}, { message: 'page must be a numeric string' })
  page?: string;

  @ApiPropertyOptional({ description: 'Page size for pagination', example: '10' })
  @IsOptional()
  @IsNumberString({}, { message: 'limit must be a numeric string' })
  limit?: string;

  @ApiPropertyOptional({ description: 'Single category name or ID' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Comma-separated categories list' })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiPropertyOptional({ description: 'Text-based location filter' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Latitude for location-based filtering', example: '40.7128' })
  @IsOptional()
  @Matches(/^[-+]?\d+(\.\d+)?$/, {
    message: 'lat must be a valid decimal string',
  })
  lat?: string;

  @ApiPropertyOptional({ description: 'Longitude for location-based filtering', example: '-74.0060' })
  @IsOptional()
  @Matches(/^[-+]?\d+(\.\d+)?$/, {
    message: 'lng must be a valid decimal string',
  })
  lng?: string;

  @ApiPropertyOptional({ description: 'Maximum distance in kilometers', example: '30' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'maxDistanceKm must be a valid number',
  })
  maxDistanceKm?: string;

  @ApiPropertyOptional({ description: 'Job type: URGENT or ANYTIME', enum: JobType })
  @IsOptional()
  @IsEnum(JobType, { message: 'jobType must be either URGENT or ANYTIME' })
  jobType?: string;

  @ApiPropertyOptional({ description: 'Payment type: HOURLY or FIXED', enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType, { message: 'paymentType must be either HOURLY or FIXED' })
  paymentType?: string;

  @ApiPropertyOptional({
    description: 'Job status filter: posted, counter_offer, confirmed, ongoing, completed, paid',
  })
  @IsOptional()
  @IsString()
  jobStatus?: string;

  @ApiPropertyOptional({ description: 'Job urgency filter: urgent or normal' })
  @IsOptional()
  @IsString()
  urgency?: string;

  @ApiPropertyOptional({ description: 'Minimum price filter' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'minPrice must be a valid number',
  })
  minPrice?: string;

  @ApiPropertyOptional({ description: 'Maximum price filter' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'maxPrice must be a valid number',
  })
  maxPrice?: string;

  @ApiPropertyOptional({ description: 'Price range as "min,max"', example: '50,200' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?,\d+(\.\d+)?$/, {
    message: 'priceRange must be two numbers separated by a comma',
  })
  priceRange?: string;

  @ApiPropertyOptional({ description: 'Minimum rating filter', example: '3.5' })
  @IsOptional()
  @Matches(/^[0-5](\.\d+)?$/, {
    message: 'minRating must be between 0 and 5',
  })
  minRating?: string;

  @ApiPropertyOptional({ description: 'Maximum rating filter', example: '5' })
  @IsOptional()
  @Matches(/^[0-5](\.\d+)?$/, {
    message: 'maxRating must be between 0 and 5',
  })
  maxRating?: string;

  @ApiPropertyOptional({ description: 'Date range as "startDate,endDate"', example: '2024-01-01,2024-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/, {
    message: 'dateRange must be in the format YYYY-MM-DD,YYYY-MM-DD',
  })
  dateRange?: string;

  @ApiPropertyOptional({ description: 'Created-after date filter', example: '2024-01-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'createdAfter must be a valid ISO 8601 date string' })
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'Created-before date filter', example: '2024-12-31' })
  @IsOptional()
  @IsISO8601({}, { message: 'createdBefore must be a valid ISO 8601 date string' })
  createdBefore?: string;

  @ApiPropertyOptional({ description: 'Free-text search across title and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field selection',
    enum: ['price_asc', 'price_desc', 'rating_asc', 'rating_desc', 'distance', 'urgency', 'urgency_recent', 'created_at', 'alphabetic_asc', 'alphabetic_desc'],
  })
  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value.join(',') : (value != null ? String(value) : value))
  @IsString()
  sortBy?: string; // supports comma-separated multi-sort

// 

}


