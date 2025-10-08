import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsArray, ValidateNested, IsDecimal, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateJobRequirementDto } from './create-job-requirement.dto';
import { CreateJobNoteDto } from './create-job-note.dto';
import { JobCategory } from '../enums/job-category.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { JobType } from '../enums/job-type.enum';

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
  @IsEnum(JobCategory)
  @ApiProperty({
    description: 'Job category',
    example: JobCategory.TECHNOLOGY,
    enum: JobCategory,
    enumName: 'JobCategory',
  })
  category: JobCategory;


  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Job price',
    example: 5000,
  })
  price: number;

  @IsNotEmpty()
  @IsEnum(PaymentType)
  @ApiProperty({
    description: 'Payment type',
    example: PaymentType.FIXED,
    enum: PaymentType,
    enumName: 'PaymentType',
  })
  payment_type: PaymentType;

  @IsNotEmpty()
  @IsEnum(JobType)
  @ApiProperty({
    description: 'Job type',
    example: JobType.URGENT,
    enum: JobType,
    enumName: 'JobType',
  })
  job_type: JobType;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Job location (optional if latitude/longitude provided)',
    example: 'New York, NY',
    required: false,
  })
  location?: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Job location latitude (from device GPS)',
    example: 40.7128,
  })
  latitude: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Job location longitude (from device GPS)',
    example: -74.0060,
  })
  longitude: number;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({
    description: 'Job start time',
    example: '2024-01-15T10:00:00Z',
  })
  start_time: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({
    description: 'Job end time',
    example: '2024-01-15T12:00:00Z',
  })
  end_time: string;

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

  // Urgent Note
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Urgent note for the job',
    example: 'This job needs to be completed urgently within 24 hours',
    required: false,
  })
  urgent_note?: string;
}
