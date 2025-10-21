import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationRepository } from '../../../common/repository/notification/notification.repository';
import { LocationService } from '../../../common/lib/Location/location.service';
import { FirebaseNotificationService } from '../firebase-notification/firebase-notification.service';
import { NearbyJobsService } from './nearby-jobs.service';

@Injectable()
export class JobNotificationService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
    private firebaseNotificationService: FirebaseNotificationService,
    private nearbyJobsService: NearbyJobsService
  ) {}

  /**
   * Notify helpers about a new job based on their preferences
   */
  async notifyHelpersAboutNewJob(jobId: string): Promise<void> {
    try {
      // Use the new nearby jobs service for better location-based notifications
      await this.nearbyJobsService.notifyHelpersAboutNewJob(jobId);
      console.log(`Notification process completed successfully for job ${jobId}`);
    } catch (error) {
      console.error(`Error notifying helpers about job ${jobId}:`, error);
    }
  }

  /**
   * Find helpers who should be notified about this job
   * Only filters by distance - all helpers within radius get notified regardless of price/category
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
        max_distance_km: true,
      },
    });

    // Filter helpers based on criteria
    const eligibleHelpers = helpers.filter(helper => {
      // Only check distance - notify all helpers within radius regardless of price/category
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
      // 1. Send WebSocket notification (existing system)
      await NotificationRepository.createNotification({
        sender_id: job.user_id, // Job owner
        receiver_id: helper.id, // Helper
        text: `New job available: ${job.title} - $${job.price} in ${job.location}`,
        type: 'booking',
        entity_id: job.id,
      });

      // 2. Send Firebase push notification (new system)
      await this.sendFirebaseNotification(job, helper);

      console.log(`Notification sent successfully to helper ${helper.id} for job ${job.id}`);
    } catch (error) {
      console.error(`Failed to send notification to helper ${helper.id}:`, error);
    }
  }

  /**
   * Send Firebase push notification to helper
   */
  private async sendFirebaseNotification(job: any, helper: any): Promise<void> {
    try {
      // Use the new Firebase notification service method
      await this.firebaseNotificationService.sendJobNotification({
        receiverId: helper.id,
        jobId: job.id,
        jobTitle: job.title,
        jobPrice: job.price,
        jobLocation: job.location,
        senderId: job.user_id,
        notificationType: 'new_job'
      });
    } catch (error) {
      console.error(`Failed to send Firebase notification to helper ${helper.id}:`, error);
    }
  }

  /**
   * Remove invalid device token from user's tokens array
   */
  private async removeInvalidDeviceToken(userId: string, invalidToken: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { device_tokens: true }
      });

      if (user?.device_tokens) {
        const updatedTokens = user.device_tokens.filter(token => token !== invalidToken);
        await this.prisma.user.update({
          where: { id: userId },
          data: { device_tokens: updatedTokens }
        });
      }
    } catch (error) {
      console.error(`Failed to remove invalid device token for user ${userId}:`, error);
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

  /**
   * Add device token for push notifications
   */
  async addDeviceToken(userId: string, deviceToken: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { device_tokens: true }
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const existingTokens = user.device_tokens || [];
      
      // Add token if it doesn't already exist
      if (!existingTokens.includes(deviceToken)) {
        const updatedTokens = [...existingTokens, deviceToken];
        await this.prisma.user.update({
          where: { id: userId },
          data: { device_tokens: updatedTokens }
        });
        console.log(`Device token added successfully for user ${userId}`);
      } else {
        console.log(`Device token already exists for user ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to add device token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove device token
   */
  async removeDeviceToken(userId: string, deviceToken: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { device_tokens: true }
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const existingTokens = user.device_tokens || [];
      const updatedTokens = existingTokens.filter(token => token !== deviceToken);
      
      await this.prisma.user.update({
        where: { id: userId },
        data: { device_tokens: updatedTokens }
      });
      
      console.log(`Device token removed successfully for user ${userId}`);
    } catch (error) {
      console.error(`Failed to remove device token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's device tokens
   */
  async getUserDeviceTokens(userId: string): Promise<string[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { device_tokens: true }
      });

      return user?.device_tokens || [];
    } catch (error) {
      console.error(`Failed to get device tokens for user ${userId}:`, error);
      return [];
    }
  }
}
