import { IsOptional, IsNumber, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateHelperPreferencesDto {
  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: 'Maximum distance in kilometers for job notifications',
    example: 20,
    required: false,
  })
  maxDistanceKm?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: 'Minimum job price to get notified about',
    example: 100,
    required: false,
  })
  minJobPrice?: number;

  @IsOptional()
  @IsNumber()
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
    description: 'Preferred job categories to get notified about (category names)',
    example: ['technology', 'event_planning', 'cleaning'],
    required: false,
  })
  preferredCategories?: string[];

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
