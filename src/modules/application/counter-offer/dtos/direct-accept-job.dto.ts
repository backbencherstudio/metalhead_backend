import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class DirectAcceptJobDto {
  @ApiProperty({
    description: 'Helper ID who is accepting the job (automatically extracted from JWT token)',
    example: 'cmfrqdk4d0004ihmoaoki1jg7',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  helper_id?: string;

  @ApiProperty({
    description: 'Optional note from helper',
    example: 'I can start immediately and complete this project within the timeline',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  note?: string;
}
