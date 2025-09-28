import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class DirectAcceptJobDto {
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
