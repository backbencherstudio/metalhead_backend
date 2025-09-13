
// src/modules/application/counter-offer/counter-offer.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { AcceptCounterOfferDto } from '../counter-offer/dtos/accept-counter-offer.dto';
import { AcceptedCounterOfferResponseDto } from '../counter-offer/dtos/accepted-counter-offer-response.dto';
import { UserCounterOfferDto } from './dtos/user-counter-offer.dto';

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

    // 2. Create counter-offer
    return this.prisma.counterOffer.create({
      data: {
        job_id,
        helper_id,
        amount,
        type,
        note,
      },
    });
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
    // 1. Fetch counter-offer with job
    const counterOffer = await this.prisma.counterOffer.findUnique({
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
      await this.prisma.job.update({
        where: { id: counterOffer.job.id },
        data: { user_id },
      });
      counterOffer.job.user_id = user_id;
    }
    if (counterOffer.job.user_id !== user_id)
      throw new ForbiddenException('You are not authorized to accept this counter offer');

    // 4. Ensure the job does not already have an accepted offer
    const existingAcceptedForJob = await this.prisma.acceptedOffer.findFirst({
      where: { job_id: counterOffer.job.id },
      select: { id: true },
    });
    if (existingAcceptedForJob) {
      throw new ForbiddenException('This job already has an accepted offer');
    }

    // 5. Create AcceptedOffer
    const acceptedOffer = await this.prisma.acceptedOffer.create({
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

    // 6. Update job.final_price
    await this.prisma.job.update({
      where: { id: counterOffer.job.id },
      data: { final_price: counterOffer.amount },
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
    };

    return response;
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

    // If job has no owner yet (null), assign the caller as the owner to unblock counter-back
    if (!original.job.user_id) {
      await this.prisma.job.update({ where: { id: original.job.id }, data: { user_id } });
      original.job.user_id = user_id;
    }

    // Only job owner can counter back
    if (original.job.user_id !== user_id) {
      throw new ForbiddenException('You are not authorized to counter this offer');
    }

    // Cannot counter back after acceptance
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
    const newOffer = await this.prisma.counterOffer.create({
      data: {
        job_id: original.job_id,
        helper_id: original.helper_id,
        amount,
        type,
        note,
      },
    });

    return newOffer;
  }

}
