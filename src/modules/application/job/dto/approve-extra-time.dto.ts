import { IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveExtraTimeDto {
  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({
    description: 'Whether to approve or reject the extra time request',
    example: true,
  })
  approved: boolean;

  @ApiProperty({
    description: 'Optional message to the helper about the decision',
    example: 'Approved. Please take your time to do the job properly.',
    required: false,
  })
  message?: string;
}
