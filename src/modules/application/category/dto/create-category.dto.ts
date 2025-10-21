import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name (unique identifier)',
    example: 'cleaning',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Display label for the category',
    example: 'Cleaning Services',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;
}
