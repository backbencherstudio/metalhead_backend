import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';

export class LatestJobResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ 
    description: 'Latest job data (null if no job found)', 
    type: JobResponseDto,
    nullable: true 
  })
  data: JobResponseDto | null;
}

