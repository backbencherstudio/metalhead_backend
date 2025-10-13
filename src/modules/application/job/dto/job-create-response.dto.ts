import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';

export class JobCreateResponseDto {
  @ApiProperty({
    description: 'Indicates if the job was created successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Job created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The created job data',
    type: JobResponseDto,
  })
  data: JobResponseDto;
}
