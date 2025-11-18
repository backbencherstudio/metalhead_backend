import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Photos field (ignored - photos are handled via file uploads)',
    required: false,
  })
  photos?: string; // This will be accepted but ignored since photos come from file uploads

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Job category name',
    example: 'technology',
  })
  category: string;


  @IsOptional()
  @IsString()
  @Transform(({ value }) => value.split(',').map(item => item.trim()))
  @ApiProperty({ required: false })
  deleted_photos?: string[];

}
