
// src/modules/application/counter-offer/counter-offer.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { AcceptCounterOfferDto } from '../counter-offer/dtos/accept-counter-offer.dto';
import { AcceptedCounterOfferResponseDto } from '../counter-offer/dtos/accepted-counter-offer-response.dto';
import { UserCounterOfferDto } from './dtos/user-counter-offer.dto';
import { HelperAcceptCounterOfferDto } from './dtos/helper-accept-counter-offer.dto';
import { NotificationRepository } from '../../../common/repository/notification/notification.repository';

@Injectable()
export class CounterOfferService {
  constructor(private prisma: PrismaService) {}

  async createCounterOffer(dto: CreateCounterOfferDto) {
    const { job_id, amount, type, note, helper_id } = dto;

    // 1. Verify job exists
    const job = await this.prisma.job.findUnique({
      where: { id: job_id },
      select: { id: true, user_id: true },
    });
    if (!job) throw new NotFoundException('Job not found');

    // 2. Check if job already has an accepted offer
    const existingAcceptedOffer = await this.prisma.acceptedOffer.findFirst({
      where: { job_id },
      select: { id: true },
    });
    if (existingAcceptedOffer) {
      throw new ForbiddenException('Cannot create counter offer: job already has an accepted offer');
    }

    // 3. Create counter-offer and update job status to "counter_offer"
    const result = await this.prisma.$transaction(async (tx) => {
      const counterOffer = await tx.counterOffer.create({
        data: {
          job_id,
          helper_id,
          amount,
          type,
          note,
        },
      });

      // Update job status to "counter_offer" when first counter offer is created
      // This ensures the job shows as having active negotiations
      await tx.job.update({
        where: { id: job_id },
        data: { job_status: 'counter_offer' },
      });

      // Create status history entry
      await (tx as any).jobStatusHistory?.create({
        data: {
          job_id,
          status: 'counter_offer',
          occurred_at: new Date(),
          meta: { counter_offer_id: counterOffer.id, amount, type },
        },
      });

      return counterOffer;
    });

    // 4. Send notification to job owner about new counter offer
    try {
      await NotificationRepository.createNotification({
        sender_id: helper_id,
        receiver_id: job.user_id,
        text: `New counter offer received for job: ${amount} ${type}`,
        type: 'booking',
        entity_id: result.id,
      });
    } catch (error) {
      console.error('Failed to send counter offer notification:', error);
      // Don't throw error to avoid breaking the main flow
    }

    return result;
  }

  async getCounterOffersByJob(job_id: string) {
    return this.prisma.counterOffer.findMany({
      where: { job_id },
      include: {
        helper: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getCounterOffersByHelper(helper_id: string) {
    return this.prisma.counterOffer.findMany({
      where: { helper_id },
      include: {
        job: {
          select: { id: true, title: true, description: true },
        },
      },
    });
  }


  // src/modules/application/counter-offer/counter-offer.service.ts
  async acceptCounterOffer(counter_offer_id: string, user_id: string): Promise<AcceptedCounterOfferResponseDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch counter-offer with job
      const counterOffer = await tx.counterOffer.findUnique({
        where: { id: counter_offer_id },
        include: {
          job: true,
          helper: true,
          acceptedOffer: true, // check if already accepted
        },
      });

      if (!counterOffer) throw new NotFoundException('Counter offer not found');

      // 2. Ensure this counter-offer is not already accepted
      if (counterOffer.acceptedOffer)
        throw new ForbiddenException('This counter offer is already accepted');

      // 3. Ensure the user accepting it is the **owner of the job**
      // If job has no owner yet (null), assign the caller as the owner to unblock acceptance.
      if (!counterOffer.job.user_id) {
        await tx.job.update({
          where: { id: counterOffer.job.id },
          data: { user_id },
        });
        counterOffer.job.user_id = user_id;
      }
      if (counterOffer.job.user_id !== user_id)
        throw new ForbiddenException('You are not authorized to accept this counter offer');

      // 4. Ensure the job does not already have an accepted offer
      const existingAcceptedForJob = await tx.acceptedOffer.findFirst({
        where: { job_id: counterOffer.job.id },
        select: { id: true },
      });
      if (existingAcceptedForJob) {
        throw new ForbiddenException('This job already has an accepted offer');
      }

      // 5. Create AcceptedOffer
      const acceptedOffer = await tx.acceptedOffer.create({
        data: {
          counter_offer_id: counter_offer_id,
          job_id: counterOffer.job.id,
          user_id: user_id,
        },
        include: {
          counter_offer: {
            select: {
              id: true,
              amount: true,
              type: true,
              note: true,
              helper: { select: { id: true, name: true, first_name: true, last_name: true, email: true } },
            },
          },
          job: true,
          user: true,
        },
      });

      // 6. Update job.final_price and status to "confirmed"
      await tx.job.update({
        where: { id: counterOffer.job.id },
        data: { 
          final_price: Number(counterOffer.amount),
          job_status: 'confirmed'
        },
      });

      // Add status history for confirmed
      await (tx as any).jobStatusHistory?.create({
        data: {
          job_id: counterOffer.job.id,
          status: 'confirmed',
          occurred_at: new Date(),
          meta: { accepted_counter_offer_id: acceptedOffer.id },
        },
      });

      const response: AcceptedCounterOfferResponseDto = {
        job_id: acceptedOffer.job.id,
        job_title: acceptedOffer.job.title ?? '',
        original_price: acceptedOffer.job.price ? Number(acceptedOffer.job.price) : 0,
        counter_offer_amount: Number(acceptedOffer.counter_offer.amount),
        counter_offer_type: acceptedOffer.counter_offer.type,
        counter_offer_note: acceptedOffer.counter_offer.note ?? undefined,
        helper_id: acceptedOffer.counter_offer.helper.id,
        helper_name: (
          acceptedOffer.counter_offer.helper.name ??
          [acceptedOffer.counter_offer.helper.first_name, acceptedOffer.counter_offer.helper.last_name]
            .filter(Boolean)
            .join(' ')
        ) || '',
        helper_email: acceptedOffer.counter_offer.helper.email ?? '',
        status: 'accepted',
      };

      return response;
    });
  }

  // Add notification after counter offer acceptance
  async acceptCounterOfferWithNotification(counter_offer_id: string, user_id: string): Promise<AcceptedCounterOfferResponseDto> {
    const result = await this.acceptCounterOffer(counter_offer_id, user_id);
    
    // Send notification to helper about offer acceptance
    try {
      await NotificationRepository.createNotification({
        sender_id: user_id,
        receiver_id: result.helper_id,
        text: `Your counter offer has been accepted for job: ${result.job_title}`,
        type: 'booking',
        entity_id: counter_offer_id,
      });
    } catch (error) {
      console.error('Failed to send acceptance notification:', error);
      // Don't throw error to avoid breaking the main flow
    }

    return result;
  }

  async declineCounterOffer(counter_offer_id: string, user_id: string) {
    // Fetch counter offer with job and acceptedOffer
    const counterOffer = await this.prisma.counterOffer.findUnique({
      where: { id: counter_offer_id },
      include: { job: true, acceptedOffer: true },
    });
    if (!counterOffer) throw new NotFoundException('Counter offer not found');

    // Only the job owner can decline
    if (counterOffer.job.user_id !== user_id) {
      throw new ForbiddenException('You are not authorized to decline this counter offer');
    }

    // Cannot decline an already accepted offer
    if (counterOffer.acceptedOffer) {
      throw new ForbiddenException('Cannot decline an already accepted counter offer');
    }

    // For simplicity, delete the counter offer (alternatively, mark status = declined)
    await this.prisma.counterOffer.delete({ where: { id: counter_offer_id } });

    return { success: true };
  }

  async userCounterBack(counter_offer_id: string, dto: UserCounterOfferDto) {
    const { amount, type, note, user_id } = dto;

    // Load original counter offer with job and helper
    const original = await this.prisma.counterOffer.findUnique({
      where: { id: counter_offer_id },
      include: { job: true, helper: true, acceptedOffer: true },
    });
    if (!original) throw new NotFoundException('Counter offer not found');

    // Check if job already has an accepted offer FIRST (before any other checks)
    const existingAcceptedOffer = await this.prisma.acceptedOffer.findFirst({
      where: { job_id: original.job_id },
      select: { id: true },
    });
    if (existingAcceptedOffer) {
      throw new ForbiddenException('Cannot counter back: job already has an accepted offer');
    }

    // If job has no owner yet (null), assign the caller as the owner to unblock counter-back
    if (!original.job.user_id) {
      await this.prisma.job.update({ where: { id: original.job.id }, data: { user_id } });
      original.job.user_id = user_id;
    }

    // Only job owner can counter back
    if (original.job.user_id !== user_id) {
      throw new ForbiddenException('You are not authorized to counter this offer');
    }

    // Cannot counter back after acceptance (double check)
    if (original.acceptedOffer) {
      throw new ForbiddenException('Cannot counter after an offer has been accepted');
    }

    // Ensure only users (not helpers) can counter back
    const actor = await this.prisma.user.findUnique({ where: { id: user_id }, select: { type: true } });
    if (!actor) throw new NotFoundException('User not found');
    if (actor.type && actor.type !== 'user') {
      throw new ForbiddenException('Only users can counter back a helper\'s offer');
    }

    // Create a new counter offer from the user to the same helper on same job
    const newOffer = await this.prisma.$transaction(async (tx) => {
      const counterOffer = await tx.counterOffer.create({
        data: {
          job_id: original.job_id,
          helper_id: original.helper_id,
          amount,
          type,
          note,
        },
      });

      // Update job status to "counter_offer" when user counters back
      // This maintains the negotiation state until an offer is accepted
      await tx.job.update({
        where: { id: original.job_id },
        data: { job_status: 'counter_offer' },
      });

      return counterOffer;
    });

    return newOffer;
  }

  async helperAcceptCounterOffer(counter_offer_id: string, dto: HelperAcceptCounterOfferDto): Promise<AcceptedCounterOfferResponseDto> {
    const { helper_id } = dto;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch counter-offer with job and helper
      const counterOffer = await tx.counterOffer.findUnique({
        where: { id: counter_offer_id },
        include: {
          job: true,
          helper: true,
          acceptedOffer: true,
        },
      });

      if (!counterOffer) throw new NotFoundException('Counter offer not found');

      // 2. Ensure this counter-offer is not already accepted
      if (counterOffer.acceptedOffer)
        throw new ForbiddenException('This counter offer is already accepted');

      // 3. Ensure the helper accepting it is the **helper who received the counter offer**
      if (counterOffer.helper_id !== helper_id) {
        throw new ForbiddenException('You are not authorized to accept this counter offer');
      }

      // 4. Ensure only helpers can accept counter offers
      const actor = await tx.user.findUnique({ where: { id: helper_id }, select: { type: true } });
      if (!actor) throw new NotFoundException('Helper not found');
      if (actor.type && actor.type !== 'helper') {
        throw new ForbiddenException('Only helpers can accept counter offers');
      }

      // 5. Check if job already has an accepted offer
      const existingAcceptedForJob = await tx.acceptedOffer.findFirst({
        where: { job_id: counterOffer.job.id },
        select: { id: true },
      });
      if (existingAcceptedForJob) {
        throw new ForbiddenException('This job already has an accepted offer');
      }

      // 6. Create AcceptedOffer
      const acceptedOffer = await tx.acceptedOffer.create({
        data: {
          counter_offer_id: counter_offer_id,
          job_id: counterOffer.job.id,
          user_id: counterOffer.job.user_id, // job owner
        },
        include: {
          counter_offer: {
            select: {
              id: true,
              amount: true,
              type: true,
              note: true,
              helper: { select: { id: true, name: true, first_name: true, last_name: true, email: true } },
            },
          },
          job: true,
          user: true,
        },
      });

      // 7. Update job.final_price and status to "confirmed"
      await tx.job.update({
        where: { id: counterOffer.job.id },
        data: { 
          final_price: Number(counterOffer.amount),
          job_status: 'confirmed'
        },
      });

      // Add status history for confirmed
      await (tx as any).jobStatusHistory?.create({
        data: {
          job_id: counterOffer.job.id,
          status: 'confirmed',
          occurred_at: new Date(),
          meta: { accepted_counter_offer_id: acceptedOffer.id },
        },
      });

      const response: AcceptedCounterOfferResponseDto = {
        job_id: acceptedOffer.job.id,
        job_title: acceptedOffer.job.title ?? '',
        original_price: acceptedOffer.job.price ? Number(acceptedOffer.job.price) : 0,
        counter_offer_amount: Number(acceptedOffer.counter_offer.amount),
        counter_offer_type: acceptedOffer.counter_offer.type,
        counter_offer_note: acceptedOffer.counter_offer.note ?? undefined,
        helper_id: acceptedOffer.counter_offer.helper.id,
        helper_name: (
          acceptedOffer.counter_offer.helper.name ??
          [acceptedOffer.counter_offer.helper.first_name, acceptedOffer.counter_offer.helper.last_name]
            .filter(Boolean)
            .join(' ')
        ) || '',
        helper_email: acceptedOffer.counter_offer.helper.email ?? '',
        status: 'accepted',
      };

      return response;
    });
  }

  // Add notification after helper accepts counter offer
  async helperAcceptCounterOfferWithNotification(counter_offer_id: string, dto: HelperAcceptCounterOfferDto): Promise<AcceptedCounterOfferResponseDto> {
    const result = await this.helperAcceptCounterOffer(counter_offer_id, dto);
    
    // Get job owner ID for notification
    const job = await this.prisma.job.findUnique({
      where: { id: result.job_id },
      select: { user_id: true }
    });
    
    // Send notification to job owner about helper acceptance
    if (job?.user_id) {
      try {
        await NotificationRepository.createNotification({
          sender_id: dto.helper_id,
          receiver_id: job.user_id,
          text: `Helper has accepted your counter offer for job: ${result.job_title}`,
          type: 'booking',
          entity_id: counter_offer_id,
        });
      } catch (error) {
        console.error('Failed to send helper acceptance notification:', error);
        // Don't throw error to avoid breaking the main flow
      }
    }

    return result;
  }

  async directAcceptJob(jobId: string, dto: any): Promise<any> {
    const { helper_id, note } = dto;
    
    if (!helper_id) {
      throw new ForbiddenException('Helper ID is required');
    }

    // 1. Verify job exists and get job details
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (!job.user_id) {
      throw new ForbiddenException('Job must have an owner before it can be accepted');
    }

    // 2. Fetch helper information
    const helper = await this.prisma.user.findUnique({
      where: { id: helper_id },
      select: { id: true, name: true, first_name: true, last_name: true, email: true },
    });

    if (!helper) {
      throw new NotFoundException('Helper not found');
    }

    // 3. Check if job already has an accepted offer
    const existingAcceptedOffer = await this.prisma.acceptedOffer.findFirst({
      where: { job_id: jobId },
      select: { id: true },
    });

    if (existingAcceptedOffer) {
      throw new ForbiddenException('Job already has an accepted offer');
    }

    // 4. Create counter offer and accepted offer in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create counter offer with original job price
      const counterOffer = await tx.counterOffer.create({
        data: {
          job_id: jobId,
          helper_id,
          amount: job.price,
          type: 'direct_accept',
          note: note || 'I can start immediately and complete this project within the timeline',
        },
      });

      // Create accepted offer
      const acceptedOffer = await tx.acceptedOffer.create({
        data: {
          job_id: jobId,
          counter_offer_id: counterOffer.id,
          user_id: job.user_id, // Add the job owner's user_id
        },
      });

      // Update job status to confirmed
      await tx.job.update({
        where: { id: jobId },
        data: {
          job_status: 'confirmed',
          final_price: job.price,
        },
      });

      return {
        job_id: jobId,
        job_title: job.title,
        original_price: job.price,
        counter_offer_amount: counterOffer.amount,
        counter_offer_type: counterOffer.type,
        counter_offer_note: counterOffer.note,
        helper_id,
        helper_name: (
          helper.name ??
          [helper.first_name, helper.last_name]
            .filter(Boolean)
            .join(' ')
        ) || '',
        helper_email: helper.email ?? '',
        status: 'accepted',
      };
    });

    // 5. Send notification to job owner
    try {
      await NotificationRepository.createNotification({
        sender_id: helper_id,
        receiver_id: job.user_id,
        text: `A helper has directly accepted your job: ${job.title}`,
        type: 'booking',
        entity_id: jobId,
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    return result;
  }

}
