import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationRepository } from '../../../common/repository/notification/notification.repository';

@Injectable()
export class CounterOfferNotificationService {
  constructor(private prisma: PrismaService) { }

  /**
   * Send notification when helper creates a counter offer
   */
  async notifyUserAboutCounterOffer(counterOfferId: string): Promise<void> {
    try {
      const counterOffer = await this.prisma.counterOffer.findUnique({
        where: { id: counterOfferId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              user_id: true,
            },
          },
          helper: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!counterOffer || !counterOffer.job.user_id) {
        console.error(`Counter offer ${counterOfferId} or job owner not found`);
        return;
      }

      const helperName = [counterOffer.helper.first_name, counterOffer.helper.last_name]
        .filter(Boolean)
        .join(' ') || 'A helper';

      await NotificationRepository.createNotification({
        sender_id: counterOffer.helper.id,
        receiver_id: counterOffer.job.user_id,
        text: `${helperName} sent you a counter offer: $${counterOffer.amount} ${counterOffer.type} for job "${counterOffer.job.title}"`,
        type: 'booking',
        entity_id: counterOffer.job.id,
      });

      console.log(`Counter offer notification sent to user ${counterOffer.job.user_id} for job ${counterOffer.job.id}`);
    } catch (error) {
      console.error('Failed to send counter offer notification:', error);
    }
  }

  /**
   * Send notification when user counters back to helper
   */
  async notifyHelperAboutUserCounterBack(counterOfferId: string): Promise<void> {
    try {
      const counterOffer = await this.prisma.counterOffer.findUnique({
        where: { id: counterOfferId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              user_id: true,
            },
          },
          helper: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!counterOffer) {
        console.error(`Counter offer ${counterOfferId} not found`);
        return;
      }

      await NotificationRepository.createNotification({
        sender_id: counterOffer.job.user_id,
        receiver_id: counterOffer.helper.id,
        text: `The job owner countered your offer with $${counterOffer.amount} ${counterOffer.type} for job "${counterOffer.job.title}"`,
        type: 'booking',
        entity_id: counterOffer.job.id,
      });

      console.log(`User counter back notification sent to helper ${counterOffer.helper.id} for job ${counterOffer.job.id}`);
    } catch (error) {
      console.error('Failed to send user counter back notification:', error);
    }
  }

  /**
   * Send notification when user accepts helper's counter offer
   */
  async notifyHelperAboutAcceptance(counterOfferId: string): Promise<void> {
    try {
      const counterOffer = await this.prisma.counterOffer.findUnique({
        where: { id: counterOfferId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              user_id: true,
            },
          },
          helper: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!counterOffer) {
        console.error(`Counter offer ${counterOfferId} not found`);
        return;
      }

      await NotificationRepository.createNotification({
        sender_id: counterOffer.job.user_id,
        receiver_id: counterOffer.helper.id,
        text: `Great news! Your counter offer has been accepted for job "${counterOffer.job.title}". You can now start working on it.`,
        type: 'booking',
        entity_id: counterOffer.job.id,
      });

      console.log(`Acceptance notification sent to helper ${counterOffer.helper.id} for job ${counterOffer.job.id}`);
    } catch (error) {
      console.error('Failed to send acceptance notification:', error);
    }
  }

  /**
   * Send notification when helper accepts user's counter offer
   */
  async notifyUserAboutHelperAcceptance(counterOfferId: string): Promise<void> {
    try {
      const counterOffer = await this.prisma.counterOffer.findUnique({
        where: { id: counterOfferId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              user_id: true,
            },
          },
          helper: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!counterOffer || !counterOffer.job.user_id) {
        console.error(`Counter offer ${counterOfferId} or job owner not found`);
        return;
      }

      const helperName = [counterOffer.helper.first_name, counterOffer.helper.last_name]
        .filter(Boolean)
        .join(' ') || 'A helper';

      await NotificationRepository.createNotification({
        sender_id: counterOffer.helper.id,
        receiver_id: counterOffer.job.user_id,
        text: `${helperName} has accepted your counter offer for job "${counterOffer.job.title}". The job is now confirmed!`,
        type: 'booking',
        entity_id: counterOffer.job.id,
      });

      console.log(`Helper acceptance notification sent to user ${counterOffer.job.user_id} for job ${counterOffer.job.id}`);
    } catch (error) {
      console.error('Failed to send helper acceptance notification:', error);
    }
  }

  /**
   * Send notification when helper directly accepts a job
   */
  async notifyUserAboutDirectAcceptance(jobId: string, helperId: string): Promise<void> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          title: true,
          user_id: true,
        },
      });

      if (!job || !job.user_id) {
        console.error(`Job ${jobId} or job owner not found`);
        return;
      }

      const helper = await this.prisma.user.findUnique({
        where: { id: helperId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      });

      if (!helper) {
        console.error(`Helper ${helperId} not found`);
        return;
      }

      const helperName = [helper.first_name, helper.last_name]
        .filter(Boolean)
        .join(' ') || 'A helper';

      await NotificationRepository.createNotification({
        sender_id: helperId,
        receiver_id: job.user_id,
        text: `${helperName} has directly accepted your job "${job.title}". The job is now confirmed!`,
        type: 'booking',
        entity_id: job.id,
      });

      console.log(`Direct acceptance notification sent to user ${job.user_id} for job ${job.id}`);
    } catch (error) {
      console.error('Failed to send direct acceptance notification:', error);
    }
  }
}
