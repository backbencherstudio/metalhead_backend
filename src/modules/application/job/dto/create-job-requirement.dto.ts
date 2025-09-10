import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobRequirementDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Requirement title',
    example: 'Must have 3+ years experience',
  })
  title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Requirement description',
    example: 'Candidate must have at least 3 years of experience in web development',
  })
  description: string;
}
