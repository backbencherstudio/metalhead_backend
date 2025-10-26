import { IsNotEmpty, IsNumber, Min, Max, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RequestExtraTimeDto {
  @IsNotEmpty()
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
  hours: number;
}
