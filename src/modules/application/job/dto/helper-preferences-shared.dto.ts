import { IsOptional, IsNumber, IsArray, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HelperPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  @ApiProperty({
    description: 'Maximum distance in kilometers for job notifications',
    example: 20,
    required: false,
  })
  maxDistanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: 'Minimum job price to get notified about',
    example: 100,
    required: false,
  })
  minJobPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: 'Maximum job price to get notified about',
    example: 10000,
    required: false,
  })
  maxJobPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'Preferred job category IDs to get notified about',
    example: ['clx123456789', 'clx987654321'],
    required: false,
  })
  preferredCategoryIds?: string[];

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: 'Helper location latitude',
    example: 40.7128,
    required: false,
  })
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: 'Helper location longitude',
    example: -74.0060,
    required: false,
  })
  longitude?: number;
}

export interface HelperPreferencesResponse {
  maxDistanceKm: number;
  minJobPrice?: number;
  maxJobPrice?: number;
  preferredCategories: string[];
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  notificationTypes: string[];
}
