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
    description: 'Job list data with pagination',
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
      },
      totalPages: {
        type: 'number',
        description: 'Total number of pages'
      },
      currentPage: {
        type: 'number',
        description: 'Current page number'
      }
    }
  })
  data: {
    jobs: JobResponseDto[];
    total: number;
    totalPages: number;
    currentPage: number;
  };
}

