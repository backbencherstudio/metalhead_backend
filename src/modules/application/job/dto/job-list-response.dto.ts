import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';

export class JobListResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Jobs retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Job list data (no pagination - Flutter handles pagination)',
    type: 'object',
    properties: {
      jobs: {
        type: 'array',
        items: { $ref: '#/components/schemas/JobResponseDto' },
        description: 'Array of job objects'
      },
      total: {
        type: 'number',
        description: 'Total number of jobs matching the criteria'
      }
    }
  })
  data: {
    jobs: JobResponseDto[];
    total: number;
  };
}

