import { ApiProperty } from '@nestjs/swagger';

export class UserStatsResponseDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  user_name: string;

  @ApiProperty()
  user_type: string;

  @ApiProperty()
  total_jobs_completed: number;

  @ApiProperty()
  total_jobs_delivered: number;

  @ApiProperty()
  average_rating: number;

  @ApiProperty()
  total_reviews: number;

  @ApiProperty()
  recent_reviews: {
    id: string;
    rating: number;
    comment?: string;
    created_at: Date;
    reviewer: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
    job: {
      id: string;
      title: string;
    };
  }[];

  @ApiProperty()
  rating_breakdown: {
    five_star: number;
    four_star: number;
    three_star: number;
    two_star: number;
    one_star: number;
  };
}
