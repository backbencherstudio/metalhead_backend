import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsArray, IsString, Min, Max } from 'class-validator';

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
    description: 'Preferred job categories to get notified about (category names)',
    example: ['cleaning', 'handyman', 'technology'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCategories?: string[];
}

