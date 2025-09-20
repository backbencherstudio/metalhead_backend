import { ApiProperty } from '@nestjs/swagger';

export class JobActionButtonDto {
  @ApiProperty()
  action: string; // 'start', 'complete', 'mark_finished', 'auto_complete'

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ required: false })
  reason?: string; // Why button is disabled

  @ApiProperty({ required: false })
  countdown?: number; // Seconds until auto-completion
}

export class JobSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  price: number;

  @ApiProperty({ required: false })
  final_price?: number;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ required: false })
  accepted_offer?: {
    helper_id: string;
    helper_name: string;
    amount: number;
  };

  @ApiProperty({ type: [JobActionButtonDto] })
  available_actions: JobActionButtonDto[];
}

export class HelperDashboardDto {
  @ApiProperty()
  helper_id: string;

  @ApiProperty()
  helper_name: string;

  @ApiProperty()
  total_jobs: number;

  @ApiProperty()
  active_jobs: number;

  @ApiProperty()
  completed_jobs: number;

  @ApiProperty()
  total_earnings: number;

  @ApiProperty()
  pending_earnings: number;

  @ApiProperty()
  stripe_onboarding_completed: boolean;

  @ApiProperty()
  can_receive_payments: boolean;

  @ApiProperty({ type: [JobSummaryDto] })
  recent_jobs: JobSummaryDto[];

  @ApiProperty({ type: [JobSummaryDto] })
  active_jobs_list: JobSummaryDto[];
}

export class UserDashboardDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  user_name: string;

  @ApiProperty()
  total_jobs_posted: number;

  @ApiProperty()
  active_jobs: number;

  @ApiProperty()
  completed_jobs: number;

  @ApiProperty()
  total_spent: number;

  @ApiProperty()
  pending_payments: number;

  @ApiProperty({ type: [JobSummaryDto] })
  recent_jobs: JobSummaryDto[];

  @ApiProperty({ type: [JobSummaryDto] })
  active_jobs_list: JobSummaryDto[];
}

export class JobActionStateDto {
  @ApiProperty()
  job_id: string;

  @ApiProperty()
  job_status: string;

  @ApiProperty()
  user_role: string; // 'owner' or 'helper'

  @ApiProperty({ type: [JobActionButtonDto] })
  available_actions: JobActionButtonDto[];

  @ApiProperty({ required: false })
  auto_complete_at?: Date;

  @ApiProperty({ required: false })
  auto_release_at?: Date;
}
