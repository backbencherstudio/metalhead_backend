import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewDto, ReviewResponseDto, JobReviewsResponseDto, UserReviewsSummaryDto, UpdateReviewDto, UserStatsResponseDto } from './dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createReview(createReviewDto: CreateReviewDto, reviewerId: string): Promise<ReviewResponseDto> {
    const { rating, comment, job_id } = createReviewDto;

    // Verify the job exists and is completed
    const job = await this.prisma.job.findUnique({
      where: { id: job_id },
      include: {
        accepted_counter_offer: {
          include: {
            helper: true,
          },
        },
        assigned_helper: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.job_status !== 'completed') {
      throw new BadRequestException('Reviews can only be created for completed jobs');
    }

    // Verify the reviewer is either the job owner or the helper
    const isJobOwner = job.user_id === reviewerId;
    const isHelper = job.accepted_counter_offer?.helper_id === reviewerId || job.assigned_helper_id === reviewerId;

    if (!isJobOwner && !isHelper) {
      throw new ForbiddenException('Only job participants can create reviews');
    }

    // Automatically determine the reviewee (the other participant)
    const reviewee_id = isJobOwner 
      ? (job.accepted_counter_offer?.helper_id || job.assigned_helper_id)
      : job.user_id;

    if (!reviewee_id) {
      throw new BadRequestException('Cannot determine the other job participant');
    }

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: {
        job_id,
        reviewer_id: reviewerId,
        reviewee_id,
      },
    });

    if (existingReview) {
      throw new BadRequestException('Review already exists for this job');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        rating,
        comment,
        reviewer_id: reviewerId,
        reviewee_id,
        job_id,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
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
          },
        },
      },
    });

    return this.mapToResponseDto(review);
  }

  async updateReview(reviewId: string, updateReviewDto: UpdateReviewDto, userId: string): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
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
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewer_id !== userId) {
      throw new ForbiddenException('Can only update your own reviews');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: updateReviewDto,
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
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
          },
        },
      },
    });

    return this.mapToResponseDto(updatedReview);
  }

  async deleteReview(reviewId: string, userId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewer_id !== userId) {
      throw new ForbiddenException('Can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });
  }

  async averageReview(userId: string,userType:string) {
    if(userType=='user'){
      const reviews= await this.prisma.review.findMany({
        where:{reviewee_id:userId,
        job:{
          user_id:userId,
        }
      }
    })
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    return {
      average_rating: averageRating,
      total_reviews: reviews.length,
      recent_reviews: reviews.map(review => this.mapToResponseDto(review)),
    }

    }else if(userType=='helper'){
      const reviews= await this.prisma.review.findMany({
        where:{
          reviewee_id:userId,
          job:{
            assigned_helper_id:userId,
          }
        }
      })
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      return {
        average_rating: averageRating,
        total_reviews: reviews.length,
        
      }
    }
    else {
      throw new BadRequestException('Invalid user type');
    }
   
  }

  async getUserReviews(userId: string, page: number = 1, limit: number = 10): Promise<UserReviewsSummaryDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reviews = await this.prisma.review.findMany({
      where: { reviewee_id: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
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
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const allReviews = await this.prisma.review.findMany({
      where: { reviewee_id: userId },
      select: { rating: true },
    });

    const averageRating = allReviews.length > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length 
      : 0;

    return {
      user_id: user.id,
      user_name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: allReviews.length,
      recent_reviews: reviews.map(review => this.mapToResponseDto(review)),
    };
  }

  async getMyReviews(userId: string, page: number = 1, limit: number = 10): Promise<ReviewResponseDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { reviewer_id: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
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
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return reviews.map(review => this.mapToResponseDto(review));
  }

  async getUserStats(userId: string): Promise<UserStatsResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        type: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all reviews for this user
    const reviews = await this.prisma.review.findMany({
      where: { reviewee_id: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Calculate statistics
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    // Rating breakdown
    const ratingBreakdown = {
      five_star: reviews.filter(r => r.rating === 5).length,
      four_star: reviews.filter(r => r.rating === 4).length,
      three_star: reviews.filter(r => r.rating === 3).length,
      two_star: reviews.filter(r => r.rating === 2).length,
      one_star: reviews.filter(r => r.rating === 1).length,
    };

    // Get job statistics based on user type
    let totalJobsCompleted = 0;
    let totalJobsDelivered = 0;

    if (user.type === 'user') {
      // For users: count jobs they posted that are completed
      totalJobsCompleted = await this.prisma.job.count({
        where: {
          user_id: userId,
          job_status: 'completed',
          status: 1,
          deleted_at: null,
        },
      });
    } else if (user.type === 'helper') {
      // For helpers: count jobs they completed as helper
      totalJobsDelivered = await this.prisma.job.count({
        where: {
          OR: [
            {
              accepted_counter_offer: {
                helper_id: userId,
              },
            },
            {
              assigned_helper_id: userId,
            },
          ],
          job_status: 'completed',
          status: 1,
          deleted_at: null,
        },
      });
    }

    // Get recent reviews (last 5)
    // const recentReviews = reviews.slice(0, 5).map(review => ({
    //   id: review.id,
    //   rating: review.rating,
    //   comment: review.comment,
    //   created_at: review.created_at,
    //   reviewer: {
    //     id: review.reviewer.id,
    //     name: review.reviewer.name || [review.reviewer.first_name, review.reviewer.last_name].filter(Boolean).join(' ') || 'Unknown',
    //     email: review.reviewer.email,
    //     avatar: review.reviewer.avatar,
    //   },
    //   job: {
    //     id: review.job.id,
    //     title: review.job.title || 'Untitled Job',
    //   },
    // }));

    return {
      user_id: user.id,
      user_name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
      user_type: user.type || 'user',
      total_jobs_completed: totalJobsCompleted,
      total_jobs_delivered: totalJobsDelivered,
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: totalReviews,
      // recent_reviews: recentReviews,
      rating_breakdown: ratingBreakdown,
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
        name: review.reviewer.name || [review.reviewer.first_name, review.reviewer.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: review.reviewer.email,
        avatar: review.reviewer.avatar,
      },
      reviewee: {
        id: review.reviewee.id,
        name: review.reviewee.name || [review.reviewee.first_name, review.reviewee.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: review.reviewee.email,
        avatar: review.reviewee.avatar,
      },
      job_id: review.job_id,
    };
  }
}
