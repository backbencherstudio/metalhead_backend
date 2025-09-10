import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobNoteDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Note title',
    example: 'Important Notice',
  })
  title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Note description',
    example: 'This job requires immediate availability',
  })
  description: string;
}
