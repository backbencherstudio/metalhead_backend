import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddExtraTimeDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Extra minutes must be at least 1' })
  @ApiProperty({
    description: 'Number of extra minutes to add to the job',
    example: 30,
    minimum: 1,
  })
  extraMinutes: number;
}
