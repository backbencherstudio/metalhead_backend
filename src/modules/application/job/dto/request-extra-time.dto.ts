import { IsNotEmpty, IsNumber, Min, Max, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RequestExtraTimeDto {
  @IsNotEmpty({ message: 'extra_hours should not be empty' })
  @IsNumber({}, { message: 'extra_hours must be a number' })
  @Type(() => Number)
  @Min(0.5, { message: 'Extra time must be at least 0.5 hours' })
  @Max(8, { message: 'Extra time cannot exceed 8 hours' })
  @ApiProperty({
    description: 'Extra time to request in hours (0.5 to 8 hours)',
    example: 2,
    minimum: 0.5,
    maximum: 8,
  })
  extra_hours: number;

  @IsNotEmpty({ message: 'reason should not be empty' })
  @IsString({ message: 'reason must be a string' })
  @ApiProperty({
    description: 'Reason for requesting extra time',
    example: 'The furniture is heavier than expected and requires additional time for safe moving',
  })
  reason: string;
}
