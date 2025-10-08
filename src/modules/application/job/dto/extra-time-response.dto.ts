import { ApiProperty } from '@nestjs/swagger';

export class ExtraTimeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  job_status: string;

  @ApiProperty()
  estimated_hours: number;

  @ApiProperty()
  extra_time_requested: number | null;

  @ApiProperty()
  extra_time_approved: boolean | null;

  @ApiProperty()
  total_approved_hours: number | null;

  @ApiProperty()
  total_approved_hours_formatted: string | null;

  @ApiProperty()
  extra_time_requested_at: Date | null;

  @ApiProperty()
  extra_time_approved_at: Date | null;

  @ApiProperty()
  hourly_rate: number | null;

  @ApiProperty()
  original_price: number;

  @ApiProperty()
  estimated_extra_cost: number | null;

  @ApiProperty()
  reason: string | null;
}
