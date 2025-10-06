import { ApiProperty } from '@nestjs/swagger';
import { JobCategory } from '../enums/job-category.enum';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category key',
    example: JobCategory.CLEANING,
    enum: JobCategory,
  })
  key: JobCategory;

  @ApiProperty({
    description: 'Human-readable category label',
    example: 'Cleaning Services',
  })
  label: string;

  @ApiProperty({
    description: 'Category description',
    example: 'House cleaning, office cleaning, deep cleaning services',
  })
  description: string;
}

export class CategoriesListResponseDto {
  @ApiProperty({
    description: 'List of available job categories',
    type: [CategoryResponseDto],
  })
  categories: CategoryResponseDto[];

  @ApiProperty({
    description: 'Total number of categories',
    example: 21,
  })
  total: number;
}













