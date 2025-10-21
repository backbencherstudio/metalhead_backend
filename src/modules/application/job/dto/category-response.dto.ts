import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category key',
    example: 'cleaning',
  })
  key: string;

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














