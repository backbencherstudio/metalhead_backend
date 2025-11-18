// src/modules/application/job/dto/my-jobs-search.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class MyJobsSearchDto {
  @ApiPropertyOptional({ description: 'Comma-separated category names', example: 'cleaning,plumbing' })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiPropertyOptional({ description: 'Payment type', enum: ['HOURLY','FIXED'] })
  @IsOptional()
  @IsIn(['HOURLY','FIXED'])
  paymentType?: string;

  @ApiPropertyOptional({ description: 'Urgency', enum: ['URGENT','ANYTIME'] })
  @IsOptional()
  @IsIn(['URGENT','ANYTIME'])
  urgency?: string;

  @ApiPropertyOptional({ description: 'Job status e.g., posted,counter_offer,confirmed,ongoing,completed,paid,cancelled' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page', example: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ description: 'Limit', example: '10' })
  @IsOptional()
  @IsString()
  limit?: string;
}