import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { 
  HelperDashboardDto, 
  UserDashboardDto, 
  JobActionStateDto, 
  JobActionButtonDto,
  JobSummaryDto 
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Get helper dashboard data
  async getHelperDashboard(helperId: string): Promise<HelperDashboardDto> {
    const helper = await this.prisma.user.findUnique({
      where: { id: helperId },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        stripe_onboarding_completed: true,
        stripe_payouts_enabled: true,
      },
    });

    if (!helper) {
      throw new NotFoundException('Helper not found');
    }

    // Get job statistics
    const [
      totalJobs,
      activeJobs,
      completedJobs,
      recentJobs,
      activeJobsList
    ] = await Promise.all([
      this.prisma.job.count({
        where: {
          accepted_offers: {
            some: {
              counter_offer: {
                helper_id: helperId,
              },
            },
          },
        },
      }),
      this.prisma.job.count({
        where: {
          accepted_offers: {
            some: {
              counter_offer: {
                helper_id: helperId,
              },
            },
          },
          job_status: { in: ['confirmed', 'ongoing'] },
        },
      }),
      this.prisma.job.count({
        where: {
          accepted_offers: {
            some: {
              counter_offer: {
                helper_id: helperId,
              },
            },
          },
          job_status: 'completed',
        },
      }),
      this.getHelperRecentJobs(helperId, 5),
      this.getHelperActiveJobs(helperId),
    ]);

    // Calculate earnings
    const earningsData = await this.calculateHelperEarnings(helperId);

    return {
      helper_id: helper.id,
      helper_name: helper.name || `${helper.first_name} ${helper.last_name}`.trim(),
      total_jobs: totalJobs,
      active_jobs: activeJobs,
      completed_jobs: completedJobs,
      total_earnings: earningsData.total,
      pending_earnings: earningsData.pending,
      stripe_onboarding_completed: helper.stripe_onboarding_completed || false,
      can_receive_payments: helper.stripe_payouts_enabled || false,
      recent_jobs: recentJobs,
      active_jobs_list: activeJobsList,
    };
  }

  // Get user dashboard data
  async getUserDashboard(userId: string): Promise<UserDashboardDto> {
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

    // Get job statistics
    const [
      totalJobsPosted,
      activeJobs,
      completedJobs,
      recentJobs,
      activeJobsList
    ] = await Promise.all([
      this.prisma.job.count({
        where: { user_id: userId },
      }),
      this.prisma.job.count({
        where: {
          user_id: userId,
          job_status: { in: ['confirmed', 'ongoing'] },
        },
      }),
      this.prisma.job.count({
        where: {
          user_id: userId,
          job_status: 'completed',
        },
      }),
      this.getUserRecentJobs(userId, 5),
      this.getUserActiveJobs(userId),
    ]);

    // Calculate spending
    const spendingData = await this.calculateUserSpending(userId);

    return {
      user_id: user.id,
      user_name: user.name || `${user.first_name} ${user.last_name}`.trim(),
      total_jobs_posted: totalJobsPosted,
      active_jobs: activeJobs,
      completed_jobs: completedJobs,
      total_spent: spendingData.total,
      pending_payments: spendingData.pending,
      recent_jobs: recentJobs,
      active_jobs_list: activeJobsList,
    };
  }

  // Get job action states for a specific job
  async getJobActionState(jobId: string, userId: string): Promise<JobActionStateDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Determine user role
    const isOwner = job.user_id === userId;
    const isHelper = job.accepted_offers.some(
      offer => offer.counter_offer.helper_id === userId
    );

    if (!isOwner && !isHelper) {
      throw new NotFoundException('You are not authorized to view this job');
    }

    const userRole = isOwner ? 'owner' : 'helper';
    const availableActions = this.getAvailableActions(job, userRole);

    return {
      job_id: job.id,
      job_status: job.job_status || 'posted',
      user_role: userRole,
      available_actions: availableActions,
      auto_complete_at: this.calculateAutoCompleteTime(job),
      auto_release_at: this.calculateAutoReleaseTime(job),
    };
  }

  // Helper methods
  private async getHelperRecentJobs(helperId: string, limit: number): Promise<JobSummaryDto[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        accepted_offers: {
          some: {
            counter_offer: {
              helper_id: helperId,
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    return jobs.map(job => this.mapToJobSummary(job, 'helper'));
  }

  private async getHelperActiveJobs(helperId: string): Promise<JobSummaryDto[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        accepted_offers: {
          some: {
            counter_offer: {
              helper_id: helperId,
            },
          },
        },
        job_status: { in: ['confirmed', 'ongoing'] },
      },
      orderBy: { created_at: 'desc' },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    return jobs.map(job => this.mapToJobSummary(job, 'helper'));
  }

  private async getUserRecentJobs(userId: string, limit: number): Promise<JobSummaryDto[]> {
    const jobs = await this.prisma.job.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    return jobs.map(job => this.mapToJobSummary(job, 'owner'));
  }

  private async getUserActiveJobs(userId: string): Promise<JobSummaryDto[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        user_id: userId,
        job_status: { in: ['confirmed', 'ongoing'] },
      },
      orderBy: { created_at: 'desc' },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    return jobs.map(job => this.mapToJobSummary(job, 'owner'));
  }

  private async calculateHelperEarnings(helperId: string): Promise<{ total: number; pending: number }> {
    const completedJobs = await this.prisma.job.findMany({
      where: {
        accepted_offers: {
          some: {
            counter_offer: {
              helper_id: helperId,
            },
          },
        },
        job_status: 'completed',
      },
      select: {
        final_price: true,
        job_status: true,
      },
    });

    const total = completedJobs.reduce((sum, job) => sum + Number(job.final_price || 0), 0);
    const pending = completedJobs.filter(job => job.job_status === 'completed').length * 0; // Will be updated with payment status

    return { total, pending };
  }

  private async calculateUserSpending(userId: string): Promise<{ total: number; pending: number }> {
    const completedJobs = await this.prisma.job.findMany({
      where: {
        user_id: userId,
        job_status: 'completed',
      },
      select: {
        final_price: true,
        job_status: true,
      },
    });

    const total = completedJobs.reduce((sum, job) => sum + Number(job.final_price || 0), 0);
    const pending = completedJobs.filter(job => job.job_status === 'completed').length * 0; // Will be updated with payment status

    return { total, pending };
  }

  private mapToJobSummary(job: any, userRole: 'owner' | 'helper'): JobSummaryDto {
    const acceptedOffer = job.accepted_offers?.[0];
    
    return {
      id: job.id,
      title: job.title,
      status: job.job_status || 'posted',
      price: Number(job.price),
      final_price: job.final_price ? Number(job.final_price) : undefined,
      created_at: job.created_at,
      accepted_offer: acceptedOffer ? {
        helper_id: acceptedOffer.counter_offer.helper.id,
        helper_name: acceptedOffer.counter_offer.helper.name || 
          `${acceptedOffer.counter_offer.helper.first_name} ${acceptedOffer.counter_offer.helper.last_name}`.trim(),
        amount: Number(acceptedOffer.counter_offer.amount),
      } : undefined,
      available_actions: this.getAvailableActions(job, userRole),
    };
  }

  private getAvailableActions(job: any, userRole: 'owner' | 'helper'): JobActionButtonDto[] {
    const actions: JobActionButtonDto[] = [];
    const jobStatus = job.job_status || 'posted';

    if (userRole === 'helper') {
      // Helper actions
      if (jobStatus === 'confirmed') {
        actions.push({
          action: 'start',
          enabled: true,
        });
      } else if (jobStatus === 'ongoing') {
        actions.push({
          action: 'complete',
          enabled: true,
        });
      }
    } else if (userRole === 'owner') {
      // Owner actions
      if (jobStatus === 'completed') {
        actions.push({
          action: 'mark_finished',
          enabled: true,
        });
      }
    }

    // Auto-complete action (for both roles)
    if (jobStatus === 'completed') {
      const autoCompleteTime = this.calculateAutoCompleteTime(job);
      if (autoCompleteTime) {
        const now = new Date();
        const timeUntilAutoComplete = Math.max(0, Math.floor((autoCompleteTime.getTime() - now.getTime()) / 1000));
        
        actions.push({
          action: 'auto_complete',
          enabled: timeUntilAutoComplete > 0,
          countdown: timeUntilAutoComplete,
        });
      }
    }

    return actions;
  }

  private calculateAutoCompleteTime(job: any): Date | null {
    if (job.job_status !== 'completed') return null;
    
    // Auto-complete after 24 hours
    const completedAt = job.updated_at; // Assuming this is when job was completed
    return new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
  }

  private calculateAutoReleaseTime(job: any): Date | null {
    if (job.job_status !== 'completed') return null;
    
    // Auto-release payment after 24 hours of completion
    const completedAt = job.updated_at;
    return new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
  }
}
