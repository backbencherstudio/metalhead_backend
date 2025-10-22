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
          status: 1
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true,
            }
          },
          assigned_helper: {
            select: {
              id: true,
              name: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true
            }
          },
          accepted_counter_offer: {
            include: {
              helper: {
                select: {
                  id: true,
                  name: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  phone_number: true
                }
              }
            }
          },
          counter_offers: {
            include: {
              helper: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
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
    
    return count;
  }
}