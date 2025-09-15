import { ApiProperty } from '@nestjs/swagger';

export class UserReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  avatar?: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  comment?: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ type: UserReviewResponseDto })
  reviewer: UserReviewResponseDto;

  @ApiProperty({ type: UserReviewResponseDto })
  reviewee: UserReviewResponseDto;

  @ApiProperty()
  job_id: string;
}

export class JobReviewsResponseDto {
  @ApiProperty()
  job_id: string;

  @ApiProperty()
  job_title: string;

  @ApiProperty({ type: [ReviewResponseDto] })
  reviews: ReviewResponseDto[];

  @ApiProperty()
  average_rating?: number;

  @ApiProperty()
  total_reviews: number;
}

export class UserReviewsSummaryDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  user_name: string;

  @ApiProperty()
  average_rating: number;

  @ApiProperty()
  total_reviews: number;

  @ApiProperty({ type: [ReviewResponseDto] })
  recent_reviews: ReviewResponseDto[];
}
