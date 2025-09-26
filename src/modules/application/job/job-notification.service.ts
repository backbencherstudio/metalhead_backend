import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
import { JobCategory } from './enums/job-category.enum';
import { LocationService } from '../../../common/lib/Location/location.service';

@Injectable()
export class JobNotificationService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService
  ) {}

  /**
   * Notify helpers about a new job based on their preferences
   */
  async notifyHelpersAboutNewJob(jobId: string): Promise<void> {
    try {
      // 1. Get the job details
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          title: true,
          category: true,
          location: true,
          latitude: true,
          longitude: true,
          price: true,
          description: true,
          user_id: true,
        },
      });

      if (!job) {
        console.error(`Job ${jobId} not found for notification`);
        return;
      }

      // 2. Find helpers who should be notified
      const eligibleHelpers = await this.findEligibleHelpers(job);

      // 3. Send notifications to each helper
      for (const helper of eligibleHelpers) {
        await this.sendJobNotification(job, helper);
      }

      console.log(`Sent job notifications to ${eligibleHelpers.length} helpers for job ${jobId}`);
    } catch (error) {
      console.error('Error notifying helpers about new job:', error);
    }
  }

  /**
   * Find helpers who should be notified about this job
   */
  private async findEligibleHelpers(job: any): Promise<any[]> {
    // Get all helpers (users with type = 'helper')
    const helpers = await this.prisma.user.findMany({
      where: {
        type: 'helper',
        status: 1, // Active users only
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        skills: true,
        max_distance_km: true,
        min_job_price: true,
        max_job_price: true,
        preferred_categories: true,
      },
    });

    // Filter helpers based on criteria
    const eligibleHelpers = helpers.filter(helper => {
      // 1. Check if helper has skills matching job requirements
      if (job.category && helper.skills && helper.skills.length > 0) {
        const hasMatchingSkill = helper.skills.some(skill => 
          skill.toLowerCase().includes(job.category.toLowerCase()) ||
          job.category.toLowerCase().includes(skill.toLowerCase())
        );
        if (!hasMatchingSkill) return false;
      }

      // 2. Check price range
      if (helper.min_job_price && job.price && Number(job.price) < Number(helper.min_job_price)) {
        return false;
      }
      if (helper.max_job_price && job.price && Number(job.price) > Number(helper.max_job_price)) {
        return false;
      }

      // 3. Check preferred categories (now using enum validation)
      if (helper.preferred_categories && helper.preferred_categories.length > 0) {
        if (!helper.preferred_categories.includes(job.category)) {
          return false;
        }
      }

      // 4. Check distance using coordinates (20km radius)
      if (helper.max_distance_km && job.latitude && job.longitude && helper.latitude && helper.longitude) {
        const isWithinDistance = this.locationService.isWithinDistance(
          job.latitude,
          job.longitude,
          helper.latitude,
          helper.longitude,
          helper.max_distance_km || 20 // Default to 20km if not set
        );
        if (!isWithinDistance) return false;
      } else if (helper.max_distance_km && job.location && helper.city) {
        // Fallback to city/state matching if coordinates not available
        const isNearby = this.isLocationNearby(job.location, helper.city, helper.state);
        if (!isNearby) return false;
      }

      return true;
    });

    return eligibleHelpers;
  }

  /**
   * Send notification to a specific helper
   */
  private async sendJobNotification(job: any, helper: any): Promise<void> {
    try {
      await NotificationRepository.createNotification({
        sender_id: job.user_id, // Job owner
        receiver_id: helper.id, // Helper
        text: `New job available: ${job.title} - $${job.price} in ${job.location}`,
        type: 'booking',
        entity_id: job.id,
      });

      console.log(`Notification sent to helper ${helper.id} for job ${job.id}`);
    } catch (error) {
      console.error(`Failed to send notification to helper ${helper.id}:`, error);
    }
  }

  /**
   * Simple location matching (you can enhance this later)
   */
  private isLocationNearby(jobLocation: string, helperCity: string, helperState: string): boolean {
    if (!jobLocation || !helperCity) return true; // If no location data, allow all

    const jobLocationLower = jobLocation.toLowerCase();
    const helperCityLower = helperCity.toLowerCase();
    const helperStateLower = helperState?.toLowerCase() || '';

    // Check if job location contains helper's city or state
    return jobLocationLower.includes(helperCityLower) || 
           jobLocationLower.includes(helperStateLower) ||
           helperCityLower.includes(jobLocationLower);
  }

  /**
   * Update helper's notification preferences
   */
  async updateHelperPreferences(
    helperId: string, 
    preferences: {
      maxDistanceKm?: number;
      minJobPrice?: number;
      maxJobPrice?: number;
      preferredCategories?: string[];
      latitude?: number;
      longitude?: number;
    }
  ): Promise<void> {
    // First, check if the user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: helperId },
      select: { id: true, type: true },
    });

    if (!existingUser) {
      throw new Error(`User with ID ${helperId} not found`);
    }

    if (existingUser.type !== 'helper') {
      throw new Error('Only helpers can update notification preferences');
    }

    // Update the user's preferences
    await this.prisma.user.update({
      where: { id: helperId },
      data: {
        max_distance_km: preferences.maxDistanceKm,
        min_job_price: preferences.minJobPrice,
        max_job_price: preferences.maxJobPrice,
        preferred_categories: preferences.preferredCategories,
        latitude: preferences.latitude,
        longitude: preferences.longitude,
      },
    });
  }
}
