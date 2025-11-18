import { PaymentTransaction } from './../../admin/payment-transaction/entities/payment-transaction.entity';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobService } from './job.service';
import { MyJobsSearchDto } from './dto/my-jobs-filter.dto';
import { parsePhotos } from './utils/job-utils';

@Injectable()
export class JobManageService {
  constructor(
    private prisma: PrismaService,
    private jobService: JobService,
  ) {}

  async jobsHistory(userId: string, userType: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (userType === 'user') {
      const jobs = await this.prisma.job.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          job_status: { not: { in: ['confirmed','ongoing','completed','paid'] } },
        },
        select: {
          id: true,
          title: true,
          category:{
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
          price: true,
          payment_type: true,
          job_type: true,
          location: true,
          latitude: true,
          longitude: true,
          start_time: true,
          end_time: true,
          
       
        },
        
      });

      return {
        success: true,
        message: 'Jobs history retrieved successfully',
        data: {
          jobs: jobs,
          pagination: {
            total: jobs.length,
            totalPages: Math.ceil(jobs.length / 10),
            currentPage: 1,
          },
        },
      };
    } else if (userType === 'helper') {
      const jobs = await this.prisma.job.findMany({
        where: {
          OR: [
            { assigned_helper_id: userId },
            { accepted_counter_offer: { helper_id: userId } },
          ],
          deleted_at: null,
          job_status: { not: { in: ['confirmed','ongoing','completed','paid'] } },
        },
        select: {
          id: true,
          title: true,
          category:{
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
          price: true,
          payment_type: true,
          job_type: true,
          location: true,
          latitude: true,
          longitude: true,
          start_time: true,
          end_time: true,
        },
      });

      return {
        success: true,
        message: 'Jobs history retrieved successfully',
          jobs: jobs,
          pagination: {
            total: jobs.length,
            totalPages: Math.ceil(jobs.length / 10),
            currentPage: 1,
          },
      };
    } else {
      throw new BadRequestException('Invalid user type');
    }
  }

  async dueJobsByDays(userId: string, days: string) {
    const daysNumber = parseInt(days);

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + daysNumber,
    );

    const count = await this.prisma.job.count({
      where: {
        assigned_helper_id: userId,
        status: 1,
        deleted_at: null,
        start_time: {
          gte: startOfDay, // Greater than or equal to start of today
          lt: endOfDay, // Less than start of tomorrow
        },
      },
    });

    return {
      success: true,
      message: 'Due jobs count retrieved successfully',
      data: { count: count },
    };
  }

  async getUserDetailsAndJobs(userId: string, days: number) {
    try {
      // Fetch user data (for ratings)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          type: true,
          avrg_rating_as_helper: true,
          avrg_rating_as_user: true,
        },
      });

      if (!user) throw new BadRequestException('User not found');

      // Calculate rating
      let rating;
      if (user.type === 'user') {
        rating = Number(user.avrg_rating_as_user ?? 0);
      } else {
        rating = Number(user.avrg_rating_as_helper ?? 0);
      }

      // Calculate earnings for the last 'days' days
      const now = new Date();
      const startOfRange = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - (days - 1),
        ),
      );
      const endOfRange = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );

      let total_earnings = 0;

      if (user.type === 'helper') {
        const payouts = await this.prisma.paymentTransaction.findMany({
          where: {
            provider: 'stripe',
            type: 'payout',
            user_id: userId,
            created_at: {
              gte: startOfRange,
              lte: endOfRange,
            },
          },
          select: {
            paid_amount: true,
          },
        });

        total_earnings = payouts.reduce(
          (sum, txn) => sum + Number(txn.paid_amount ?? 0),
          0,
        );
      } else {
        const jobs = await this.prisma.job.findMany({
          where: {
            user_id: userId,
            job_status: 'paid',
            updated_at: {
              gte: startOfRange,
              lte: endOfRange,
            },
          },
          select: {
            final_price: true,
          },
        });

        total_earnings = jobs.reduce(
          (sum, job) => sum + Number(job.final_price ?? 0),
          0,
        );
      }

      // Count due jobs for **today** (jobs assigned to the user with a start time of today)
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );

      const dueJobsCount = await this.prisma.job.count({
        where: {
          assigned_helper_id: userId,
          status: 1, // assuming status 1 means "due"
          deleted_at: null,
          start_time: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      return {
        success: true,
        message:
          'User review, earnings, and due jobs count retrieved successfully',
        data: {
          rating, // user's average rating
          total_earnings, // total earnings in the last `days` days
          due_jobs_count: dueJobsCount, // due jobs for today
        },
      };
    } catch (error) {
      console.error('Error in getUserDetailsAndJobs:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async currentRunningJobs(userId: string, userType: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [{ user_id: userId }, { assigned_helper_id: userId }],
        job_status: { in: ['confirmed', 'ongoing'] },
        deleted_at: null,
      },
      select: {
        start_time: true,
        end_time: true,
        job_status: true,
        final_price: true,
        payment_type: true,
        location: true,
        latitude: true,
        longitude: true,
        description: true,
        total_approved_hours: true,
        photos: true,
        user_id: true,
        created_at: true,
        updated_at: true,
        category: true,
      },
    });
    return {
      success: true,
      message: 'Current running jobs retrieved successfully',
      data: jobs,
    };
  }

  async getJobDetails(jobId: string, userId: string) {
    if (!jobId) {
      throw new BadRequestException('Job ID is required');
    }
    const job = await this.prisma.job.findUnique({
      where: { id: jobId
      },
      select: {
        id: true,
        title: true,
        price: true,
        final_price: true,
        payment_type: true,
        job_type: true,
        location: true,
        latitude: true,
        longitude: true,
        description: true,
        start_time: true,
        end_time: true,
        job_status: true,
        requirements: true,
        notes: true,
        photos: true,
        total_approved_hours: true,
        actual_start_time: true,
        actual_end_time: true,
        actual_hours: true,
        extra_time_requested: true,
        seen_as_helper: true,
        seen_as_user: true,
        timeline: {
          select: {
            posted: true,
            counter_offer: true,
            confirmed: true,
            ongoing: true,
            completed: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
            phone: true,
            cards: {
              where: {
                is_default: true,
              },
              select: {
                id: true,
                last_four: true,
                card_type: true,
              },
            },
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
            phone: true,
          },
        },
        category: {
          select: {
            name: true,
            label: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            created_at: true,
            updated_at: true,
            reviewer: {
              select: {
                id: true,
                first_name: true,
                avatar: true,
                type: true,
              },
            },
            reviewee: {
              select: {
                id: true,
                first_name: true,
                avatar: true,
                type: true,
              },
            },
          },
        },
      },
    });

    const paymentTransaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        order_id: jobId,
      },
      select: {
        id:true,
        amount:true,
        status:true,
        created_at:true,
      },
      orderBy:{
        created_at: 'desc',
      },
    })
    
    if (!job) {
      throw new BadRequestException('Job not found');
    }
    

    if(job.seen_as_helper==false && userId === job.assigned_helper?.id){

      await this.prisma.job.update({
        where: { id: jobId },
        data: { seen_as_helper: true },
      });
    }
    else if(job.seen_as_user===false && userId === job.user?.id){
      await this.prisma.job.update({
        where: { id: jobId },
        data: { seen_as_user: true },
      });
    }
    else{
      job.seen_as_helper = true;
      job.seen_as_user = true;
    }
 
    return {
      id: job.id,
      title: job.title,
      price: job.price,
      final_price: job.final_price,
      payment_type: job.payment_type,
      job_type: job.job_type,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude,
      description: job.description,
      start_time: job.start_time,
      end_time: job.end_time,
      job_status: job.job_status,
      timeline: job.timeline ?? [],
      requirements: job.requirements ?? [],
      notes: job.notes ?? [],
      photos: parsePhotos(job.photos) ?? [],  // parse photos from string to array
      total_approved_hours: job.total_approved_hours,
      actual_start_time: job.actual_start_time,
      actual_end_time: job.actual_end_time,
      actual_hours: job.actual_hours,
      extra_time_requested: job.extra_time_requested,
      seen_as_helper: job.seen_as_helper,
      seen_as_user: job.seen_as_user,
      user: job.user
        ? {
            id: job.user.id,
            name: job.user.name,
            first_name: job.user.first_name,
            last_name: job.user.last_name,
            email: job.user.email,
            avatar: job.user.avatar,
            phone: job.user.phone,
            cards: job.user.cards,
            stripe_payment_status: paymentTransaction?.status ?? 'pending',
          }
        : null,
      assigned_helper: job.assigned_helper
        ? {
            id: job.assigned_helper.id,
            name: job.assigned_helper.name,
            first_name: job.assigned_helper.first_name,
            last_name: job.assigned_helper.last_name,
            email: job.assigned_helper.email,
            avatar: job.assigned_helper.avatar,
            phone: job.assigned_helper.phone,
            stripe_payment_status: paymentTransaction?.status ?? 'pending',
          }
        : [],
      category: job.category
        ? {
            name: job.category.name,
            label: job.category.label,
          }
        : [],
      reviews: job.reviews ?? [],
    };
  }

  // src/modules/application/job/job-manage.service.ts
async searchMyJobs(
  userId: string,
  dto: MyJobsSearchDto,
): Promise<{ success: boolean; message: string; data: { jobs: any[]; pagination: { total: number; totalPages: number; currentPage: number } } }> {
  const page = Math.max(1, parseInt(dto.page ?? '1', 10) || 1);
  const take = Math.max(1, Math.min(parseInt(dto.limit ?? '10', 10) || 10, 100));
  const skip = (page - 1) * take;

  // association: my jobs only (poster or assigned helper)
  const baseAssociation = {
    OR: [{ user_id: userId }, { assigned_helper_id: userId }],
  };

  // filters
  const where: any = {
    ...baseAssociation,
    deleted_at: null,
  };

  if (dto.paymentType) {
    where.payment_type = dto.paymentType; // enum string stored
  }
  if (dto.urgency) {
    where.job_type = dto.urgency; // URGENT/ANYTIME
  }
  if (dto.status) {
    const statuses = dto.status.split(',').map(s => s.trim()).filter(Boolean);
    where.job_status = statuses.length > 1 ? { in: statuses } : statuses[0];
  }
  if (dto.categories) {
    const names = dto.categories.split(',').map(c => c.trim()).filter(Boolean);
    if (names.length > 0) {
      const cats = await this.prisma.category.findMany({
        where: { name: { in: names } },
        select: { id: true },
      });
      const ids = cats.map(c => c.id);
      if (ids.length > 0) {
        where.category_id = { in: ids };
      } else {
        // No matching categories -> empty result fast path
        return { success: false, message: 'No matching categories', data: { jobs: [], pagination: { total: 0, totalPages: 0, currentPage: page } } };
      }
    }
  }

  const [total, jobs] = await this.prisma.$transaction([
    this.prisma.job.count({ where }),
    this.prisma.job.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      skip,
      take,
      include: {
        category: { select: { id: true, name: true, label: true } },
      },
    }),
  ]);

  return {
    success: true,
    message: 'Jobs retrieved successfully',
    data: {
      jobs: jobs.map(j => this.jobService.mapToResponseDto(j)),
      pagination: {
        total: total,
        totalPages: total === 0 ? 0 : Math.ceil(total / take),
        currentPage: page,
      },
    },
  };
}

}
