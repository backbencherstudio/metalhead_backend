import { JobService } from './../job/job.service';
import { AcceptCounterOfferDto } from './dtos/accept-counter-offer.dto';
import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { CounterOfferNotificationService } from './counter-offer-notification.service';

@Injectable()

export class CounterOfferService {
  constructor(
    private prisma: PrismaService,
    private counterOfferNotificationService: CounterOfferNotificationService,
    readonly jobService: JobService
  ) {}

async createCounterOffer(createCounterOfferDto: CreateCounterOfferDto, userId: string){

  const job=await this.prisma.job.findUnique({
    where:{id:createCounterOfferDto.job_id},
  })
  if(!job) throw new NotFoundException('job not found');
  if (job.user_id===userId) throw new ForbiddenException('You can not counter offer your own job')
  // Check if job already has an accepted counter offer
  if(job.accepted_counter_offer_id) {
    throw new ForbiddenException('This job has already been accepted')
  }
  
  const counterOffer= await this.prisma.counterOffer.create({
    data:{
      job_id:createCounterOfferDto.job_id,
      helper_id:userId,
      amount:createCounterOfferDto.amount,
      type:createCounterOfferDto.type,
      note:createCounterOfferDto.note,
    },
    include:{
      job:{
        select:{
          assigned_helper:{
            select:{
              id:true,
              avrg_rating_as_helper:true,
              first_name:true,
              avatar:true,
            }
          }
        }
      }
    }
  })
  await this.counterOfferNotificationService.notifyUserAboutCounterOffer(counterOffer.id);
  return {
    success:true,
    message:'Counter offer created successfully',
    counter_offer:counterOffer,
  };
}


async acceptCounterOffer(acceptCounterOfferDto: AcceptCounterOfferDto, userId: string){
const counterOffer=await this.prisma.counterOffer.findUnique({
  where:{
    id:acceptCounterOfferDto.counter_offer_id,
  },
  include:{
    job:true,
    helper:true,
  }
})


if(!counterOffer) throw new NotFoundException('Counter offer not found')
if(counterOffer.helper_id===userId) throw new UnauthorizedException('You are not authorized to accept this offer');

const updatedJob= await this.prisma.job.update({
  where:{id:counterOffer.job_id},
  data:{
    job_status:'confirmed',
    status:0,
    accepted_counter_offer_id:counterOffer.id,
    assigned_helper_id:counterOffer.helper_id, // Assign the helper to the job
    final_price:counterOffer.amount,
  }
})


await this.prisma.counterOffer.deleteMany({
  where: {
    job_id: counterOffer.job_id,
    id: { not: acceptCounterOfferDto.counter_offer_id },
  },
});

const modifiedUpdatedjob=this.jobService.mapToResponseDto(updatedJob);

return{
  message:'Counter offer accepted successfully',
  success:true,
  job:modifiedUpdatedjob,
}
}

async helperAcceptsJob(helperId: string, jobId: string) {
  // Validate that the helper exists and is a helper
  const helper = await this.prisma.user.findUnique({
    where: { id: helperId },
    select: { id: true, type: true }
  });
  if (!helper) throw new NotFoundException('Helper not found');
  if (helper.type !== 'helper') throw new ForbiddenException('Only helpers can accept jobs');

  // Validate job exists and is available
  const job = await this.prisma.job.findUnique({
    where: { id: jobId }
  });
  if (!job) throw new NotFoundException('Job not found');
  if (job.user_id === helperId) throw new ForbiddenException('You cannot accept your own job');
  if (job.job_status !== 'posted') throw new ForbiddenException('Job is not available for acceptance');
  if (job.accepted_counter_offer_id || job.assigned_helper_id) {
    throw new ForbiddenException('Job has already been assigned');
  }

  // Assign the helper directly to the job
  const updatedJob = await this.prisma.job.update({
    where: { id: jobId },
    data: {
      job_status: 'confirmed',
      assigned_helper_id: helperId,
      final_price: job.price, // Use original price for direct acceptance
    }
  });

  const modifiedUpdatedjob=this.jobService.mapToResponseDto(updatedJob);

  return {
    success:true,
    message: 'Job accepted successfully',
    job: modifiedUpdatedjob,
  };
}

async getMyCounterOffers(
  userId: string,
  userType: 'user' | 'helper',
  page = 1,
  limit = 10,
) {
  const take = Math.max(1, Math.min(Number(limit) || 10, 100));
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * take;

  let where: any;
  if (userType === 'user') {
    where = { user_id: userId, accepted_counter_offer_id: { not: null } };
  } else if (userType === 'helper') {
    where = { assigned_helper_id: userId };
  } else {
    throw new ForbiddenException('You are not authorized to get counter offers');
  }

  const total = await this.prisma.job.count({ where });

  const rows = await this.prisma.job.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
    take,
    include:
      userType === 'user'
        ? {
            accepted_counter_offer: {
              include: {
                helper: { select: { id: true, name: true, avatar: true } },
              },
            },
          }
        : undefined,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / take);

  return {
    success: true,
    message: `Found ${total} jobs`,
    data: {
      jobs: rows,
      total,
      totalPages,
      currentPage,
    },
  };
}

async getCounterOffers(userId: string, jobId: string){
  const counterOffers=await this.prisma.counterOffer.findMany({
    where:{
      job_id:jobId,
      job:{
        user_id:userId,
      }
    },
    include:{
      helper:{
        select:{
          name:true,
          avatar:true,
        }
      }
    }
  })
  return {
    success:true,
    message:'Counter offers fetched successfully',
    counter_offers:counterOffers,
  };
}

async declineCounterOffer(userId: string, counterOfferId: string){
  const counterOffer=await this.prisma.counterOffer.findUnique({
    where:{
      id:counterOfferId,
    },
    include:{
      job:{
        select:{
          user_id:true,
        }
      }
    }
  })
  if(!counterOffer) throw new NotFoundException('Counter offer not found')
  if(counterOffer.job.user_id!==userId) throw new UnauthorizedException('You are not authorized to decline this offer')
  await this.prisma.counterOffer.delete({
    where:{id:counterOfferId},
  })
  return {
    success:true,
    message:'Counter offer declined successfully',
  };
}





}