import { Transform } from 'class-transformer';
import { IsOptional, IsIn, IsArray } from 'class-validator';

export class TransactionQueryDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsIn(['order', 'payout', 'commission'], {
    each: true,
    message: 'Each type must be one of the following: order, payout, commission',
  })
  type?: string[];
}

