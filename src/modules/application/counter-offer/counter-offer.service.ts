import { JobService } from './../job/job.service';
import { AcceptCounterOfferDto } from './dtos/accept-counter-offer.dto';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { CounterOfferNotificationService } from './counter-offer-notification.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { StripeMarketplaceService } from 'src/modules/payment/stripe/stripe-marketplace.service';

@Injectable()

export class CounterOfferService {
  authService: any;
  constructor(
    private prisma: PrismaService,
    private counterOfferNotificationService: CounterOfferNotificationService,
    readonly jobService: JobService,
    private stripeMarketplaceService: StripeMarketplaceService
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
  
  const IsFirstCounterOffer=await this.prisma.counterOffer.findFirst({
    where:{
      job_id:createCounterOfferDto.job_id
    }
  })

  // const checkHelperOnboardingStatus=await this.prisma.user.findUnique({
  //   where:{
  //     id:userId,
  //   },
  //   select:{
  //     stripe_onboarding_completed:true,
  //   }
  // })
  // if(!checkHelperOnboardingStatus) throw new ForbiddenException('You are not connected to a stripe account')
  // if(!checkHelperOnboardingStatus.stripe_onboarding_completed) throw new ForbiddenException('You are not onboarded to a stripe account, Complete your onboarding to continue')

  if(!IsFirstCounterOffer){
    await this.prisma.jobTimeline.update({
      where:{job_id:createCounterOfferDto.job_id},
      data:{
        counter_offer:new Date(),
      }
    })
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


// user accepts counter offer

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
  },
 
  select:{
    id: true,
    title: true,
    final_price: true,
    user: {
      select: {
        id: true,
        billing_id: true,
      },
    },
    assigned_helper: {
      select: {
        id: true,
        stripe_connect_account_id: true,
      },
    },
  }
})


const paymentIntent=await this.stripeMarketplaceService.createMarketplacePaymentIntent({
  jobId: updatedJob.id,
  finalPrice: updatedJob.final_price,
  buyerBillingId: updatedJob.user.billing_id,
  buyerUserId: updatedJob.user.id,
  helperStripeAccountId: updatedJob.assigned_helper.stripe_connect_account_id,
  jobTitle: updatedJob.title,
});

// 2) Capture immediately (money moves to your platform balance)
await this.stripeMarketplaceService.capturePaymentIntent(paymentIntent.payment_intent_id);

// 3) Persist for reconciliation
await this.prisma.job.update({
  where: { id: updatedJob.id },
  data: { payment_intent_id: paymentIntent.payment_intent_id, job_status: 'confirmed' },
});

await this.prisma.jobTimeline.update({
  where:{job_id:counterOffer.job_id},
  data:{
    confirmed:new Date(),
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
  payment_intent: paymentIntent,
}
}

async helperAcceptsJob(helperId: string, jobId: string) {

  const job = await this.prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundException('Job not found');
  if (job.accepted_counter_offer_id || job.assigned_helper_id) {
    throw new ForbiddenException('Job has already been assigned');
  }

  // Optional: prevent duplicate offers from the same helper on the same job
  const existing = await this.prisma.counterOffer.findFirst({
    where: { job_id: jobId, helper_id: helperId },
  });
  if (existing) {
    return { success: true, message: 'Offer already submitted', offer_id: existing.id };
  }

  // const checkHelperOnboardingStatus=await this.prisma.user.findUnique({
  //   where:{
  //     id:helperId,
  //   },
  //   select:{
  //     stripe_onboarding_completed:true,
  //   }
  // })
  // if(!checkHelperOnboardingStatus) throw new ForbiddenException('You are not connected to a stripe account')
  // if(!checkHelperOnboardingStatus.stripe_onboarding_completed) throw new ForbiddenException('You are not onboarded to a stripe account, Complete your onboarding to continue')

  // Create a counter offer representing the direct accept at job.price
  const offer = await this.prisma.counterOffer.create({
    data: {
      job_id: jobId,
      helper_id: helperId,
      amount: job.price!,     
      type: job.payment_type, 
    },
    select: { id: true, amount: true, type: true, note: true, created_at: true, updated_at: true }
  });

  // Put job into counter_offer state (or 'awaiting_user_approval' if you prefer)
  const updatedJob = await this.prisma.job.update({
    where: { id: jobId },
    data: { job_status: 'counter_offer', price: job.price },
    select: { id: true, title: true, job_status: true, price: true, user_id: true },
  });

  await this.prisma.jobTimeline.update({
    where:{job_id:jobId},
    data:{
      counter_offer:new Date(),
    }
  })
  

  const dto = this.jobService.mapToResponseDto(updatedJob);
  return {
    success: true,
    message: 'Direct acceptance submitted as a counter offer. Awaiting user decision.',
    offer,
    job: dto,
    
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

  // Build where by requester type
  const where =
    userType === 'user'
      ? { job: { user_id: userId } } // all offers against the user's jobs
      : { helper_id: userId };       // all offers made by the helper

  const [total, rows] = await Promise.all([
    this.prisma.counterOffer.count({ where }),
    this.prisma.counterOffer.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            price: true,
            job_status: true,
            user_id: true,
            
          },
        },
        helper: {
          select: { id: true, name: true, avatar: true,},
        },
      },
    }),
  ]);

  return {
    success: true,
    message: `Found ${total} counter offers`,
    data: {
      counter_offers: rows,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / take),
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