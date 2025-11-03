import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateReviewDto,
  ReviewResponseDto,
  JobReviewsResponseDto,
  UserReviewsSummaryDto,
  UpdateReviewDto,
  UserStatsResponseDto,
} from './dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createReview(
    createReviewDto: CreateReviewDto,
    reviewerId: string,
  ): Promise<ReviewResponseDto> {
    const { rating, comment, job_id } = createReviewDto;

    // Verify job
    const job = await this.prisma.job.findUnique({
      where: { id: job_id },
      include: {
        accepted_counter_offer: { include: { helper: true } },
        assigned_helper: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');
    if (job.job_status !== 'completed' && job.job_status !== 'paid') {
      throw new BadRequestException(
        'Reviews can only be created for completed jobs',
      );
    }

    // Verify the reviewer
    const isJobOwner = job.user_id === reviewerId;
    const isHelper =
      job.accepted_counter_offer?.helper_id === reviewerId ||
      job.assigned_helper_id === reviewerId;
    if (!isJobOwner && !isHelper)
      throw new ForbiddenException('Only job participants can create reviews');

    // Determine who is being reviewed
    const reviewee_id = isJobOwner
      ? job.accepted_counter_offer?.helper_id || job.assigned_helper_id
      : job.user_id;

    if (!reviewee_id)
      throw new BadRequestException('Cannot determine the other participant');

    // Prevent duplicate reviews
    const existingReview = await this.prisma.review.findFirst({
      where: { job_id, reviewer_id: reviewerId, reviewee_id },
    });
    if (existingReview)
      throw new BadRequestException('Review already exists for this job');

    // Create the review
    const review = await this.prisma.review.create({
      data: { rating, comment, reviewer_id: reviewerId, reviewee_id, job_id },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
            type:true
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
            type:true
          },
        },
      },
    });

    // Determine if the reviewee was a helper or user for this job
    const revieweeRole = reviewee_id === job.user_id ? 'user' : 'helper';

    // Update cumulative stats for that role
    if (revieweeRole === 'user') {
      // Get current totals
      const user = await this.prisma.user.findUnique({
        where: { id: reviewee_id },
        select: {
          total_reviews_as_user: true,
          total_ratings_as_user: true,
        },
      });

      const newTotalReviews = (user?.total_reviews_as_user ?? 0) + 1;
      const newTotalRatings = (user?.total_ratings_as_user ?? 0) + rating;
      const newAverage = newTotalRatings / newTotalReviews;

      await this.prisma.user.update({
        where: { id: reviewee_id },
        data: {
          total_reviews_as_user: newTotalReviews,
          total_ratings_as_user: newTotalRatings,
          avrg_rating_as_user: newAverage,
        },
      });
    } else {
      // Helper side
      const helper = await this.prisma.user.findUnique({
        where: { id: reviewee_id },
        select: {
          total_reviews_as_helper: true,
          total_ratings_as_helper: true,
        },
      });

      const newTotalReviews = (helper?.total_reviews_as_helper ?? 0) + 1;
      const newTotalRatings = (helper?.total_ratings_as_helper ?? 0) + rating;
      const newAverage = newTotalRatings / newTotalReviews;

      await this.prisma.user.update({
        where: { id: reviewee_id },
        data: {
          total_reviews_as_helper: newTotalReviews,
          total_ratings_as_helper: newTotalRatings,
          avrg_rating_as_helper: newAverage,
        },
      });
    }

    // Return the created review
    return this.mapToResponseDto(review);
  }

  async getUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    // Fetch user with all rating fields
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        avatar: true,
        avrg_rating_as_user: true,
        avrg_rating_as_helper: true,
        total_reviews_as_user: true,
        total_reviews_as_helper: true,
        total_ratings_as_user: true,
        total_ratings_as_helper: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Fetch reviews with pagination
    const reviews = await this.prisma.review.findMany({
      where: { reviewee_id: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            avatar: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            avatar: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalReviews = await this.prisma.review.count({
      where: { reviewee_id: userId },
    });

    return {
      user_info: {
        id: user.id,
        name:
          user.name ||
          [user.first_name, user.last_name].filter(Boolean).join(' ') ||
          'Unknown',
        avatar: user.avatar,
        avrg_rating_as_user: Number(user.avrg_rating_as_user ?? 0),
        avrg_rating_as_helper: Number(user.avrg_rating_as_helper ?? 0),
        total_reviews_as_user: user.total_reviews_as_user ?? 0,
        total_reviews_as_helper: user.total_reviews_as_helper ?? 0,
        total_ratings_as_user: user.total_ratings_as_user ?? 0,
        total_ratings_as_helper: user.total_ratings_as_helper ?? 0,
      },
      reviews: reviews.map((r) => this.mapToResponseDto(r)),
      pagination: {
        page,
        limit,
        total_reviews: totalReviews,
        total_pages: Math.ceil(totalReviews / limit),
      },
    };
  }

  async getReviewOfJob(jobId: string, currentUserId: string) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        job_status: { in: ["completed", "paid"] },
      },
      select: {
        id: true,
        created_at: true,
        updated_at: true,
        status: true,
        job_status: true,
        title: true,
        start_time: true,
        user_id: true,
        assigned_helper_id: true,
        reviews: {
          include: {
            reviewee: {
              select: { id: true, first_name: true, avatar: true, type: true },
            },
            reviewer: {
              select: { id: true, first_name: true, avatar: true, type: true },
            },
          },
        },
      },
    });
    if (!job) {
      throw new NotFoundException('Job not Found');
    }

    // Get the helper ID (could be from assigned_helper_id or accepted_counter_offer)
    let helperId = job.assigned_helper_id;
    if (!helperId) {
      // Try to get from accepted_counter_offer if exists
      const jobWithOffer = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: {
          accepted_counter_offer: {
            select: { helper_id: true },
          },
        },
      });
      helperId = jobWithOffer?.accepted_counter_offer?.helper_id || null;
    }

    // Separate reviews into "Your Review" and "Helper's Review of You"
    let yourReview = null; // Review FROM current user
    let helperReviewOfYou = null; // Review FROM helper TO current user

    if (job.reviews && job.reviews.length > 0) {
      // Find review FROM current user (they are the reviewer)
      yourReview = job.reviews.find(
        (review) => review.reviewer?.id === currentUserId
      );

      // Find review FROM helper TO current user (helper is reviewer, current user is reviewee)
      if (helperId) {
        helperReviewOfYou = job.reviews.find(
          (review) =>
            review.reviewer?.id === helperId &&
            review.reviewee?.id === currentUserId
        );
      }
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      jobStatus: job.job_status,
      yourReview: yourReview
        ? {
            id: yourReview.id,
            rating: yourReview.rating,
            comment: yourReview.comment,
            createdAt: yourReview.created_at,
          }
        : null,
      helperReviewOfYou: helperReviewOfYou
        ? {
            id: helperReviewOfYou.id,
            rating: helperReviewOfYou.rating,
            comment: helperReviewOfYou.comment,
            createdAt: helperReviewOfYou.created_at,
          }
        : null,
    };
  }

  private mapToResponseDto(review: any): ReviewResponseDto {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      updated_at: review.updated_at,
      reviewer: {
        id: review.reviewer.id,
        name:
          review.reviewer.name ||
          [review.reviewer.first_name, review.reviewer.last_name]
            .filter(Boolean)
            .join(' ') ||
          'Unknown',
        email: review.reviewer.email,
        avatar: review.reviewer.avatar,
      },
      reviewee: {
        id: review.reviewee.id,
        name:
          review.reviewee.name ||
          [review.reviewee.first_name, review.reviewee.last_name]
            .filter(Boolean)
            .join(' ') ||
          'Unknown',
        email: review.reviewee.email,
        avatar: review.reviewee.avatar,
      },
      job_id: review.job_id,
    };
  }

async myReview(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      type: true,
      avrg_rating_as_helper: true,
      avrg_rating_as_user: true,
    },
  });

  if (!user) throw new NotFoundException('User not found');

  if (user.type === 'user') {
    return {
      success: true,
      data: {
        rating: Number(user.avrg_rating_as_user ?? 0),
      },
    };
  } else {
    return Number(user.avrg_rating_as_helper ?? 0);
  }
}

async myEarningStats(userId: string, days: number) {
  // Inclusive range: from start of the day (N days ago) to end of today
  const now = new Date();

  const startOfRange = new Date(now);
  startOfRange.setHours(0, 0, 0, 0);
  startOfRange.setDate(startOfRange.getDate() - days);

  const endOfRange = new Date(now);
  endOfRange.setHours(23, 59, 59, 999);

  const jobs = await this.prisma.job.findMany({
    where: {
      assigned_helper_id: userId,
      job_status: 'paid',
      // use the correct timestamp: updated_at when job becomes paid, or created_at if you prefer
      updated_at: {
        gte: startOfRange,
        lte: endOfRange,
      },
    },
    select: { id: true, final_price: true, updated_at: true },
  });

  const total_jobs = jobs.length;
  const total_earnings = jobs.reduce((s, j) => s + Number(j.final_price ?? 0), 0);

  return {
    success: true,
    message: `Earnings for the last ${days} days`,
    data: {
      total_jobs,
      total_earnings,
      start_date: startOfRange, // for debugging/verification
      end_date: endOfRange,
    },
  };
}



}
