import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FirebaseNotificationService } from '../firebase-notification/firebase-notification.service';
import { NotificationRepository } from '../../../common/repository/notification/notification.repository';

export interface NearbyJobNotification {
  jobId: string;
  jobTitle: string;
  jobPrice: number;
  jobLocation: string;
  jobCategory: string;
  jobType: string;
  distance: number; // Distance in kilometers
  latitude: number;
  longitude: number;
  created_at: Date;
  date_and_time?: Date;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface HelperNotificationPreferences {
  maxDistanceKm: number;
  minJobPrice?: number;
  maxJobPrice?: number;
  preferredCategories: string[];
  isActive: boolean;
  notificationTypes: string[];
}

@Injectable()
export class NearbyJobsService {
  private readonly logger = new Logger(NearbyJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseNotificationService: FirebaseNotificationService,
  ) {}

  /**
   * Find nearby jobs for a specific helper based on their preferences
   */
  async findNearbyJobsForHelper(
    helperId: string,
    options: {
      maxDistanceKm?: number;
      minPrice?: number;
      maxPrice?: number;
      categories?: string[];
      limit?: number;
    } = {}
  ): Promise<NearbyJobNotification[]> {
    try {
      // Get helper's location and preferences
      const helper = await this.prisma.user.findUnique({
        where: { id: helperId },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          max_distance_km: true,
          min_job_price: true,
          max_job_price: true,
          preferred_categories: true,
          type: true,
        },
      });

      if (!helper || helper.type !== 'helper') {
        throw new Error('Helper not found or invalid user type');
      }

      if (!helper.latitude || !helper.longitude) {
        this.logger.warn(`Helper ${helperId} has no location data`);
        return [];
      }

      // Use helper's preferences or provided options
      const maxDistance = options.maxDistanceKm || helper.max_distance_km || 20;
      const minPrice = options.minPrice || helper.min_job_price;
      const maxPrice = options.maxPrice || helper.max_job_price;
      const categories = options.categories || helper.preferred_categories || [];
      const limit = options.limit || 10;

      // Build where clause for jobs
      const where: any = {
        status: 1,
        deleted_at: null,
        job_status: 'posted', // Only notify about posted jobs
        latitude: { not: null },
        longitude: { not: null },
        user_id: { not: helperId }, // Don't notify about own jobs
      };

      // Add price filters
      if (minPrice !== null && minPrice !== undefined) {
        where.price = { ...where.price, gte: minPrice };
      }
      if (maxPrice !== null && maxPrice !== undefined) {
        where.price = { ...where.price, lte: maxPrice };
      }

      // Add category filter
      if (categories && categories.length > 0) {
        where.category = { in: categories };
      }

      // Get all matching jobs
      const jobs = await this.prisma.job.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 50, // Get more jobs to filter by distance
      });

      // Calculate distances and filter by radius
      const nearbyJobs = jobs
        .map((job) => ({
          jobId: job.id,
          jobTitle: job.title,
          jobPrice: Number(job.price),
          jobLocation: job.location,
          jobCategory: job.category,
          jobType: job.job_type,
          distance: this.calculateDistance(
            helper.latitude,
            helper.longitude,
            job.latitude,
            job.longitude,
          ),
          latitude: job.latitude,
          longitude: job.longitude,
          created_at: job.created_at,
          date_and_time: job.date_and_time,
          user: job.user,
        }))
        .filter((job) => job.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance) // Sort by distance
        .slice(0, limit);

      this.logger.log(`Found ${nearbyJobs.length} nearby jobs for helper ${helperId} within ${maxDistance}km`);

      return nearbyJobs;
    } catch (error) {
      this.logger.error(`Error finding nearby jobs for helper ${helperId}:`, error);
      throw new Error(`Failed to find nearby jobs: ${error.message}`);
    }
  }

  /**
   * Notify helpers about a new job when it's posted
   */
  async notifyHelpersAboutNewJob(jobId: string): Promise<void> {
    try {
      // Get the job details
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!job || !job.latitude || !job.longitude) {
        this.logger.warn(`Job ${jobId} not found or has no location data`);
        return;
      }

      // Find eligible helpers
      const eligibleHelpers = await this.findEligibleHelpersForJob(job);

      this.logger.log(`Found ${eligibleHelpers.length} eligible helpers for job ${jobId}`);

      // Send notifications to each helper
      for (const helper of eligibleHelpers) {
        await this.sendJobNotificationToHelper(job, helper);
      }

      this.logger.log(`Notifications sent to ${eligibleHelpers.length} helpers for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Error notifying helpers about job ${jobId}:`, error);
    }
  }

  /**
   * Find helpers who should be notified about a specific job
   */
  private async findEligibleHelpersForJob(job: any): Promise<any[]> {
    try {
      // Get all helpers with location data and notification preferences
      const helpers = await this.prisma.user.findMany({
        where: {
          type: 'helper',
          status: 1,
          deleted_at: null,
          latitude: { not: null },
          longitude: { not: null },
          device_tokens: { isEmpty: false }, // Must have device tokens
        },
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          max_distance_km: true,
          min_job_price: true,
          max_job_price: true,
          preferred_categories: true,
          device_tokens: true,
        },
      });

      const eligibleHelpers = [];

      for (const helper of helpers) {
        // Check distance
        const distance = this.calculateDistance(
          helper.latitude,
          helper.longitude,
          job.latitude,
          job.longitude,
        );

        const maxDistance = helper.max_distance_km || 20;
        if (distance > maxDistance) {
          continue;
        }

        // Check price range
        if (helper.min_job_price && job.price < helper.min_job_price) {
          continue;
        }
        if (helper.max_job_price && job.price > helper.max_job_price) {
          continue;
        }

        // Check category preferences
        if (helper.preferred_categories && helper.preferred_categories.length > 0) {
          if (!helper.preferred_categories.includes(job.category)) {
            continue;
          }
        }

        eligibleHelpers.push({
          ...helper,
          distance,
        });
      }

      return eligibleHelpers;
    } catch (error) {
      this.logger.error('Error finding eligible helpers:', error);
      return [];
    }
  }

  /**
   * Send notification to a specific helper about a job
   */
  private async sendJobNotificationToHelper(job: any, helper: any): Promise<void> {
    try {
      // 1. Create in-app notification
      await NotificationRepository.createNotification({
        sender_id: job.user_id,
        receiver_id: helper.id,
        text: `🎯 New job nearby: ${job.title} - $${job.price} (${helper.distance.toFixed(1)}km away)`,
        type: 'booking',
        entity_id: job.id,
      });

      // 2. Send Firebase push notification
      await this.firebaseNotificationService.sendJobNotification({
        receiverId: helper.id,
        jobId: job.id,
        jobTitle: job.title,
        jobPrice: job.price,
        jobLocation: job.location,
        senderId: job.user_id,
        notificationType: 'new_job',
        customTitle: '🎯 New Job Nearby!',
        customBody: `${job.title} - $${job.price} (${helper.distance.toFixed(1)}km away)`,
      });

      this.logger.log(`Notification sent to helper ${helper.id} for job ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to helper ${helper.id}:`, error);
    }
  }

  /**
   * Update helper's notification preferences
   */
  async updateHelperNotificationPreferences(
    helperId: string,
    preferences: Partial<HelperNotificationPreferences>
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (preferences.maxDistanceKm !== undefined) {
        updateData.max_distance_km = preferences.maxDistanceKm;
      }
      if (preferences.minJobPrice !== undefined) {
        updateData.min_job_price = preferences.minJobPrice;
      }
      if (preferences.maxJobPrice !== undefined) {
        updateData.max_job_price = preferences.maxJobPrice;
      }
      if (preferences.preferredCategories !== undefined) {
        updateData.preferred_categories = preferences.preferredCategories;
      }

      await this.prisma.user.update({
        where: { id: helperId },
        data: updateData,
      });

      this.logger.log(`Updated notification preferences for helper ${helperId}`);
    } catch (error) {
      this.logger.error(`Error updating preferences for helper ${helperId}:`, error);
      throw new Error(`Failed to update notification preferences: ${error.message}`);
    }
  }

  /**
   * Get helper's current notification preferences
   */
  async getHelperNotificationPreferences(helperId: string): Promise<HelperNotificationPreferences> {
    try {
      const helper = await this.prisma.user.findUnique({
        where: { id: helperId },
        select: {
          max_distance_km: true,
          min_job_price: true,
          max_job_price: true,
          preferred_categories: true,
        },
      });

      if (!helper) {
        throw new Error('Helper not found');
      }

      return {
        maxDistanceKm: helper.max_distance_km || 20,
        minJobPrice: helper.min_job_price ? Number(helper.min_job_price) : undefined,
        maxJobPrice: helper.max_job_price ? Number(helper.max_job_price) : undefined,
        preferredCategories: helper.preferred_categories || [],
        isActive: true, // You can add this field to the database if needed
        notificationTypes: ['new_job'], // You can customize this
      };
    } catch (error) {
      this.logger.error(`Error getting preferences for helper ${helperId}:`, error);
      throw new Error(`Failed to get notification preferences: ${error.message}`);
    }
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get nearby jobs for a helper with pagination
   */
  async getNearbyJobsWithPagination(
    helperId: string,
    page: number = 1,
    limit: number = 10,
    filters: {
      maxDistanceKm?: number;
      minPrice?: number;
      maxPrice?: number;
      categories?: string[];
      sortBy?: 'distance' | 'price' | 'date';
    } = {}
  ): Promise<{
    jobs: NearbyJobNotification[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const allJobs = await this.findNearbyJobsForHelper(helperId, {
        maxDistanceKm: filters.maxDistanceKm,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        categories: filters.categories,
        limit: 100, // Get more to sort and paginate
      });

      // Sort jobs
      let sortedJobs = allJobs;
      if (filters.sortBy === 'price') {
        sortedJobs = allJobs.sort((a, b) => b.jobPrice - a.jobPrice);
      } else if (filters.sortBy === 'date') {
        sortedJobs = allJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        // Default: sort by distance
        sortedJobs = allJobs.sort((a, b) => a.distance - b.distance);
      }

      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedJobs = sortedJobs.slice(startIndex, endIndex);

      return {
        jobs: paginatedJobs,
        total: allJobs.length,
        totalPages: Math.ceil(allJobs.length / limit),
        currentPage: page,
      };
    } catch (error) {
      this.logger.error(`Error getting nearby jobs with pagination for helper ${helperId}:`, error);
      throw new Error(`Failed to get nearby jobs: ${error.message}`);
    }
  }
}
