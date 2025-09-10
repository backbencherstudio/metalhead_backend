import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsArray, ValidateNested, IsDecimal } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateJobRequirementDto } from './create-job-requirement.dto';
import { CreateJobNoteDto } from './create-job-note.dto';

export class CreateJobDto {
  // Job Summary
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Job title',
    example: 'Frontend Developer',
  })
  title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Job category',
    example: 'Technology',
  })
  category: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({
    description: 'Preferred date and time',
    example: '2024-01-15T10:00:00Z',
  })
  date_and_time: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Job price',
    example: 5000,
  })
  price: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Payment type',
    example: 'Fixed Price',
    enum: ['Fixed Price', 'Hourly', 'Per Project'],
  })
  payment_type: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Job type',
    example: 'Remote',
    enum: ['Remote', 'On-site', 'Hybrid'],
  })
  job_type: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Job location',
    example: 'New York, NY',
  })
  location: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Estimated time to complete',
    example: '2 weeks',
    required: false,
  })
  estimated_time?: string;

  // Job Description
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Job description',
    example: 'We are looking for a skilled frontend developer to join our team...',
  })
  description: string;

  // Job Requirements
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJobRequirementDto)
  @ApiProperty({
    description: 'Job requirements',
    type: [CreateJobRequirementDto],
    required: false,
  })
  requirements?: CreateJobRequirementDto[];

  // Important Notes
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJobNoteDto)
  @ApiProperty({
    description: 'Important notes',
    type: [CreateJobNoteDto],
    required: false,
  })
  notes?: CreateJobNoteDto[];
}
