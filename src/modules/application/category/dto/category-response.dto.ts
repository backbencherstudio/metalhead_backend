import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: 'clx123456789',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'cleaning',
  })
  name: string;

  @ApiProperty({
    description: 'Category display label',
    example: 'Cleaning Services',
  })
  label: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T00:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-01-01T00:00:00.000Z',
  })
  updated_at: Date;
}
