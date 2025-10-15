import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';

export class JobSingleResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Job retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Job data',
    type: JobResponseDto,
  })
  data: JobResponseDto;
}

