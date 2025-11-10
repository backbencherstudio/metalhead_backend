import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobService } from './job.service';

@Injectable()
export class JobManageService {
  constructor(private prisma: PrismaService,
    private jobService: JobService
  ) {}
  

  async jobsHistory(userId: string, userType: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (userType === "user") {
      const jobs = await this.prisma.job.findMany({
        where:{
          user_id:userId,
          job_status:{not:{in:["confirm","completed","cancelled"]}}
        }
      });
      
      return jobs;
    } else if (userType === "helper") {
      const jobs = await this.prisma.job.findMany({
        where: { 
          OR: [
            { assigned_helper_id: userId },
            { accepted_counter_offer: { helper_id: userId } }
          ],
          deleted_at: null,
          job_status:{not:{in:["confirm","completed","cancelled"]}}
        },
        select:{
          id:true,
          title:true,
          price:true,
          final_price:true,
          payment_type:true,
          job_type:true,
          location:true,
          latitude:true,
          longitude:true,
          description:true,
          start_time:true,
          end_time:true,
          category:{
            select:{
              name:true,
            }
          },
          reviews:{
            select:{
              id:true,
              rating:true,
              comment:true,
              created_at:true,
              updated_at:true,
              reviewer:{
                select:{
                  id:true,
                  first_name:true,
                  avatar:true,
                  type:true,
                }
              },
              reviewee:{
                select:{
                  id:true,
                  first_name:true,
                  avatar:true,
                  type:true,
                }
              }
            }
          }
        }
        
      });
      
      return jobs;
    } else {
      throw new BadRequestException('Invalid user type');
    }
  }

  async dueJobsByDays(userId: string, days: string) {

    const daysNumber = parseInt(days);

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysNumber);
    
    const count = await this.prisma.job.count({
      where: {
        assigned_helper_id:userId,
        status: 1,
        deleted_at: null,
        start_time: {
          gte: startOfDay,    // Greater than or equal to start of today
          lt: endOfDay        // Less than start of tomorrow
        }
      }
    });
    
    return {success: true, message: 'Due jobs count retrieved successfully', data: {count: count}};
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
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
      );
      const endOfRange = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
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
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
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
        message: 'User review, earnings, and due jobs count retrieved successfully',
        data: {
          rating,  // user's average rating
          total_earnings,  // total earnings in the last `days` days
          due_jobs_count: dueJobsCount,  // due jobs for today
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
  
  
  

}