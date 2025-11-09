import {Injectable,NotFoundException,BadRequestException,} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobCreateResponseDto } from './dto/job-create-response.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { JobNotificationService } from './job-notification.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';
import { CategoryService } from '../category/category.service';
import { convertEnumToCategoryName } from './utils/category-mapper.util';
import { jobType, PaymentType } from '@prisma/client';
import { RequestExtraTimeDto } from './dto/request-extra-time.dto';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { NotificationGateway } from '../notification/notification.gateway';
import { StripeMarketplaceService } from 'src/modules/payment/stripe/stripe-marketplace.service';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { commisionSpillter } from './utils/commision-spillter.util';

@Injectable()
export class JobService {
  constructor(
    private prisma: PrismaService,
    private jobNotificationService: JobNotificationService,
    private geocodingService: GeocodingService,
    private categoryService: CategoryService,
    private stripeMarketplaceService: StripeMarketplaceService,
    private notificationGateway: NotificationGateway,
  ) {}

  async create(
    createJobDto: CreateJobDto,
    userId: string,
    photoPaths?: string[],
  ): Promise<JobCreateResponseDto> {
    const { requirements, notes, ...jobData } = createJobDto;

    // Handle location data with smart fallback logic
    let latitude: number;
    let longitude: number;
    let location: string | undefined;

    // Priority 1: Use device GPS coordinates if provided
    if (jobData.latitude !== undefined && jobData.longitude !== undefined) {
      latitude = jobData.latitude;
      longitude = jobData.longitude;
      location = jobData.location ?? undefined;
    }
    // Priority 2: Use geocoding if user provided address but no GPS
    else if (
      jobData.location &&
      (jobData.latitude === undefined || jobData.longitude === undefined)
    ) {
      try {
        const coordinates = await this.geocodingService.geocodeAddress(
          jobData.location,
        );
        if (coordinates) {
          latitude = coordinates.lat;
          longitude = coordinates.lng;
          location = jobData.location;
        } else {
          throw new BadRequestException(
            'Could not geocode the provided address',
          );
        }
      } catch (error) {
        throw new BadRequestException(
          `Geocoding failed: ${error.message}. Please provide GPS coordinates or a valid address.`,
        );
      }
    }
    // Priority 3: Neither GPS nor address provided
    else {
      throw new BadRequestException(
        'Either GPS coordinates (latitude, longitude) or a valid address (location) must be provided',
      );
    }

    // Update jobData with resolved values
    jobData.latitude = latitude;
    jobData.longitude = longitude;
    jobData.location = location;

    // Calculate estimated time from start_time and end_time
    const startTime = new Date(jobData.start_time);
    const endTime = new Date(jobData.end_time);

    // Validate dates
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid start_time format');
    }
    if (isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid end_time format');
    }
    if (startTime >= endTime) {
      throw new BadRequestException('start_time must be before end_time');
    }

    const estimatedHours = this.calculateHours(startTime, endTime);
    const estimatedTimeString = this.formatEstimatedTime(estimatedHours);

    //

    // Find the category by name
    const category = await (this.prisma as any).category.findUnique({
      where: { name: jobData.category },
    });

    if (!category) {
      throw new BadRequestException(`Category '${jobData.category}' not found`);
    }


    const job = await (this.prisma as any).job.create({
      data: {
        title: jobData.title,
        category_id: category.id,
        price: jobData.price,
        payment_type: jobData.payment_type,
        job_type: jobData.job_type,
        location: jobData.location,
        latitude: jobData.latitude,
        longitude: jobData.longitude,
        start_time: startTime,
        end_time: endTime,
        estimated_time: estimatedTimeString,
        estimated_hours: estimatedHours,
        description: jobData.description,
        urgent_note: jobData.urgent_note,
        user_id: userId,
        photos:
          photoPaths && photoPaths.length > 0
            ? JSON.stringify(photoPaths)
            : null,
        // For hourly jobs, set hourly_rate
        hourly_rate: jobData.payment_type === 'HOURLY' ? jobData.price : null,
        requirements: requirements
          ? {
              create: requirements.map((req) => ({
                title: req.title,
                description: req.description,
              })),
            }
          : undefined,
        notes: notes
          ? {
              create: notes.map((note) => ({
                title: note.title,
                description: note.description,
              })),
            }
          : undefined,
      },
      include: {
        requirements: true,
        notes: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    await this.prisma.jobTimeline.create({
      data: {
        job_id: job.id,
        posted: new Date(),
      },
    });
    // record posted history
    await (this.prisma as any).jobStatusHistory?.create({
      data: {
        job_id: job.id,
        status: 'posted',
        occurred_at: job.created_at,
      },
    });

    // Notify helpers about the new job (async, don't wait)
    this.jobNotificationService
      .notifyHelpersAboutNewJob(job.id)
      .then(() => {
        console.log(
          `Notification process initiated successfully for job ${job.id}`,
        );
      })
      .catch((error) => {
        console.error('Failed to notify helpers about new job:', error);
      });

    const responseData = this.mapToResponseDto(job);

    return {
      success: true,
      message: 'Job created successfully',
      data: responseData,
    };
  }
  /**
   * Ultra-dynamic job search with pagination - supports ANY combination of filters
   * For helpers, automatically applies preference settings when filters are not provided
   */
  async searchJobsWithValidation(rawParams: SearchJobsDto, userId?: string): Promise<{
    jobs: any[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    // Parse and validate all parameters
    const {
      page,
      limit,
      category,
      categories,
      location,
      lat,
      lng,
      maxDistanceKm,
      jobType,
      paymentType,
      jobStatus,
      urgency,
      minPrice,
      maxPrice,
      priceRange,
      minRating,
      maxRating,
      dateRange,
      createdAfter,
      createdBefore,
      search,
      sortBy,
    } = rawParams;

    // Load user preferences (universal for all users)
    // Only load: maxDistanceKm, preferredCategories, latitude, longitude
    let userPreferences: {
      max_distance_km?: number;
      preferred_categories?: string[];
      latitude?: number;
      longitude?: number;
    } | null = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          max_distance_km: true,
          preferred_categories: true,
          latitude: true,
          longitude: true,
        },
      });

      // Load preferences for all users (universal)
      if (user) {
        userPreferences = {
          max_distance_km: user.max_distance_km ? Number(user.max_distance_km) : undefined,
          preferred_categories: user.preferred_categories && user.preferred_categories.length > 0 
            ? (user.preferred_categories as string[]) 
            : undefined,
          latitude: user.latitude ? Number(user.latitude) : undefined,
          longitude: user.longitude ? Number(user.longitude) : undefined,
        };
      }
    }

    // Parse pagination parameters
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;

    // Parse location parameters - use user preferences if not provided
    let searchLat = lat ? parseFloat(lat) : undefined;
    let searchLng = lng ? parseFloat(lng) : undefined;
    let maxDistance = maxDistanceKm ? parseFloat(maxDistanceKm) : undefined;

    // Track if preferences are set and being used
    let preferencesSet = false;
    let preferencesUsed = false;

    // Check if user has preferences set
    if (userPreferences) {
      preferencesSet = !!(
        userPreferences.max_distance_km ||
        userPreferences.preferred_categories ||
        (userPreferences.latitude && userPreferences.longitude)
      );
    }

    // Apply user preferences for location if not provided
    // Use user's latitude/longitude from their profile (where they created account)
    if (userPreferences && !searchLat && !searchLng) {
      if (userPreferences.latitude && userPreferences.longitude) {
        searchLat = userPreferences.latitude;
        searchLng = userPreferences.longitude;
        preferencesUsed = true;
      }
    }

    // Apply user preference for max distance if not provided
    // If user has updated max_distance_km preference, use it; otherwise default to 30km
    if (userPreferences && !maxDistance) {
      if (userPreferences.max_distance_km) {
        // Use user's updated preference
        maxDistance = userPreferences.max_distance_km;
        preferencesUsed = true;
      } else if (searchLat && searchLng) {
        // If user has location but no distance preference, default to 30km
        maxDistance = 30;
      }
    }

    // Parse price parameters
    let parsedPriceRange = null;
    if (priceRange) {
      const [min, max] = priceRange.split(',').map((str) => parseFloat(str));
      parsedPriceRange = { min, max };
    } else if (minPrice || maxPrice) {
      parsedPriceRange = {
        min: minPrice ? parseFloat(minPrice) : undefined,
        max: maxPrice ? parseFloat(maxPrice) : undefined,
      };
    }

    // Parse rating parameters
    const minRatingNum = minRating ? parseFloat(minRating) : undefined;
    const maxRatingNum = maxRating ? parseFloat(maxRating) : undefined;

    // Parse date parameters
    let parsedDateRange = null;
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',');
      parsedDateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    } else if (createdAfter || createdBefore) {
      parsedDateRange = {
        start: createdAfter ? new Date(createdAfter) : undefined,
        end: createdBefore ? new Date(createdBefore) : undefined,
      };
    }

    // Parse categories - use user preferences if not provided
    let categoriesArray = categories
      ? categories.split(',').map((c) => c.trim())
      : undefined;

    // Apply user preferences for categories if not provided
    if (!category && !categoriesArray && userPreferences && userPreferences.preferred_categories) {
      categoriesArray = userPreferences.preferred_categories;
      preferencesUsed = true;
    }

    // Validate category if provided (can be either name or ID)
    if (category) {
      // Check if it's an ID (CUID format) or name
      const isId = category.length >= 20 && category.match(/^[a-z0-9]{20,}$/i);
      
      let categoryRecord;
      if (isId) {
        categoryRecord = await this.prisma.category.findUnique({
          where: { id: category },
        });
      } else {
        categoryRecord = await this.prisma.category.findUnique({
          where: { name: category },
        });
      }
      
      if (!categoryRecord) {
        throw new BadRequestException(`Invalid category: ${category}`);
      }
    }

    // Call the existing searchJobsWithPagination method with parsed parameters
    const searchResult = await this.searchJobsWithPagination(
      {
        // Location filters
        category,
        categories: categoriesArray,
        location,
        searchLat,
        searchLng,
        maxDistanceKm: maxDistance,

        // Job property filters
        jobType,
        paymentType,
        jobStatus,
        urgency,

        // Price & rating filters
        priceRange: parsedPriceRange,
        minRating: minRatingNum,
        maxRating: maxRatingNum,

        // Date filters
        dateRange: parsedDateRange,

        // Search & sort
        search,
        sortBy,
      },
      pageNum,
      limitNum,
    );

    // Determine preference message (universal for all users)
    let preferenceMessage = '';
    if (userId) {
      // If user is logged in, check their preferences
      if (preferencesSet) {
        preferenceMessage = preferencesUsed 
          ? 'Preferences are saved and applied' 
          : 'Preferences are saved';
      } else {
        preferenceMessage = 'Preferences are not saved';
      }
    }

    return {
      ...searchResult,
      preferenceMessage,
    } as typeof searchResult & { preferenceMessage: string };
  }

  async searchJobsWithPagination(
    filters: {
      // Location filters
      category?: string;
      categories?: string[];
      location?: string;
      searchLat?: number;
      searchLng?: number;
      maxDistanceKm?: number;

      // Job property filters
      jobType?: string;
      paymentType?: string;
      jobStatus?: string;
      urgency?: string;

      // Price & rating filters
      priceRange?: { min?: number; max?: number };
      minRating?: number;
      maxRating?: number;

      // Date filters
      dateRange?: { start?: Date; end?: Date };

      // Search & sort
      search?: string;
      sortBy?: string;
    },
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    jobs: any[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    const {
      category,
      categories,
      location,
      searchLat,
      searchLng,
      maxDistanceKm,
      jobType,
      paymentType,
      jobStatus,
      urgency,
      priceRange,
      minRating,
      maxRating,
      dateRange,
      search,
      sortBy,
    } = filters;
    const whereClause: any = {
      status: 1,
      deleted_at: null,
    };

    // Category filter (single category) - accepts both name and ID
    if (category) {
      // Check if it's an ID (CUID format) or name
      const isId = category.length >= 20 && category.match(/^[a-z0-9]{20,}$/i);
      
      let categoryRecord;
      if (isId) {
        categoryRecord = await (this.prisma as any).category.findUnique({
          where: { id: category },
        });
      } else {
        categoryRecord = await (this.prisma as any).category.findUnique({
          where: { name: category },
        });
      }

      if (categoryRecord) {
        whereClause.category_id = categoryRecord.id;
      } else {
        return { jobs: [], total: 0, totalPages: 0, currentPage: 1 };
      }
    }

    // Multiple categories filter - accepts both names and IDs
    if (categories && categories.length > 0) {
      // Separate IDs from names
      const categoryIds: string[] = [];
      const categoryNames: string[] = [];
      
      categories.forEach((cat: string) => {
        const isId = cat.length >= 20 && cat.match(/^[a-z0-9]{20,}$/i);
        if (isId) {
          categoryIds.push(cat);
        } else {
          categoryNames.push(cat);
        }
      });
      
      // Build where clause for finding categories
      const whereConditions: any[] = [];
      if (categoryIds.length > 0) {
        whereConditions.push({ id: { in: categoryIds } });
      }
      if (categoryNames.length > 0) {
        whereConditions.push({ name: { in: categoryNames } });
      }
      
      if (whereConditions.length > 0) {
        const categoryRecords = await (this.prisma as any).category.findMany({
          where: {
            OR: whereConditions,
          },
        });

        if (categoryRecords.length > 0) {
          whereClause.category_id = { in: categoryRecords.map((c) => c.id) };
        } else {
          return { jobs: [], total: 0, totalPages: 0, currentPage: 1 };
        }
      }
    }

    // Location filter (case-insensitive)
    if (location) {
      whereClause.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    // Location-based filtering with lat/lng
    // Only apply if we have both coordinates AND distance (for helper preferences, distance is required)
    if (searchLat && searchLng && maxDistanceKm) {
      // This will be handled in post-processing since Prisma doesn't have built-in distance calculations
      // We'll filter by approximate bounding box first, then calculate exact distances
      const latRange = maxDistanceKm / 111; // Rough conversion: 1 degree ≈ 111 km
      const lngRange =
        maxDistanceKm / (111 * Math.cos((searchLat * Math.PI) / 180));

      whereClause.latitude = {
        gte: searchLat - latRange,
        lte: searchLat + latRange,
      };
      whereClause.longitude = {
        gte: searchLng - lngRange,
        lte: searchLng + lngRange,
      };
    } else if (searchLat && searchLng && !maxDistanceKm) {
      // If location is provided but no distance, don't filter by location
      // This allows helpers to search without distance restriction
    }

    // Job type filter
    if (jobType) {
      whereClause.job_type = jobType;
    }

    // Payment type filter
    if (paymentType) {
      whereClause.payment_type = paymentType;
    }

    // Job status filter
    if (jobStatus) {
      whereClause.job_status = jobStatus;
    }

    // Price range filter
    if (priceRange) {
      const priceFilter: any = {};
      if (priceRange.min !== undefined) priceFilter.gte = priceRange.min;
      if (priceRange.max !== undefined) priceFilter.lte = priceRange.max;
      if (Object.keys(priceFilter).length > 0) {
        whereClause.price = priceFilter;
      }
    }

    // Rating filter (through reviews relation)
    if (minRating !== undefined || maxRating !== undefined) {
      const ratingFilter: any = {};
      if (minRating !== undefined) ratingFilter.gte = minRating;
      if (maxRating !== undefined) ratingFilter.lte = maxRating;
      if (Object.keys(ratingFilter).length > 0) {
        whereClause.reviews = {
          some: {
            rating: ratingFilter,
          },
        };
      }
    }

    // Date range filter
    if (dateRange) {
      const dateFilter: any = {};
      if (dateRange.start) dateFilter.gte = dateRange.start;
      if (dateRange.end) dateFilter.lte = dateRange.end;
      if (Object.keys(dateFilter).length > 0) {
        whereClause.start_time = dateFilter;
      }
    }

    // Search filter (title and description)
    if (search) {
      whereClause.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Urgency filter
    if (urgency === 'urgent') {
      whereClause.job_type = 'URGENT';
    } else if (urgency === 'normal') {
      whereClause.job_type = 'ANYTIME';
    }

    // Build orderBy clause
    // Default sorting: Recent start_time first (upcoming jobs), then by created_at
    let orderBy: any = [
      { start_time: 'asc' }, // Upcoming/earlier start times first
      { created_at: 'desc' }, // Most recently created first as secondary sort
    ];

    if (sortBy) {
      switch (sortBy) {
        case 'price_asc':
          orderBy = { price: 'asc' };
          break;
        case 'price_desc':
          orderBy = { price: 'desc' };
          break;
        case 'rating_asc':
          // Rating sorting will be handled in post-processing
          orderBy = [
            { start_time: 'asc' },
            { created_at: 'desc' },
          ];
          break;
        case 'rating_desc':
          // Rating sorting will be handled in post-processing
          orderBy = [
            { start_time: 'asc' },
            { created_at: 'desc' },
          ];
          break;
        case 'distance':
          // Distance sorting will be handled in post-processing
          orderBy = [
            { start_time: 'asc' },
            { created_at: 'desc' },
          ];
          break;
        case 'title':
          orderBy = { title: 'asc' };
          break;
        case 'location':
          orderBy = { location: 'asc' };
          break;
        case 'urgency':
          orderBy = [
            { job_type: 'desc' }, // URGENT first
            { start_time: 'asc' }, // Then by start time
            { created_at: 'desc' },
          ];
          break;
        case 'urgency_recent':
          // Combined sorting: URGENT jobs first, then by start time, then most recent
          orderBy = [
            { job_type: 'desc' }, // URGENT first (URGENT > ANYTIME)
            { start_time: 'asc' }, // Then by start time
            { created_at: 'desc' }, // Most recent first within each job type
          ];
          break;
        case 'created_at':
          orderBy = { created_at: 'desc' };
          break;
        default:
          // Default: start_time first, then created_at
          orderBy = [
            { start_time: 'asc' },
            { created_at: 'desc' },
          ];
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              first_name: true,
              last_name: true,
              email: true,
              avatar: true,
            },
          },
          requirements: true,
          notes: true,
          counter_offers: {
            include: {
              helper: {
                select: {
                  id: true,
                  name: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                },
              },
            },
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
                },
              },
            },
          },
          assigned_helper: {
            select: {
              id: true,
              name: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              reviewer: {
                select: {
                  id: true,
                  name: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.job.count({ where: whereClause }),
    ]);

    let mappedJobs = jobs.map((job) => this.mapToResponseDto(job));

    // Post-processing for distance-based filtering and sorting
    if (searchLat && searchLng) {
      // Calculate distances and filter by exact distance
      mappedJobs = mappedJobs
        .map((job) => ({
          ...job,
          distance: this.calculateDistance(
            searchLat,
            searchLng,
            job.latitude,
            job.longitude,
          ),
        }))
        .filter((job) => !maxDistanceKm || job.distance <= maxDistanceKm);

      // Sort by distance if requested
      if (sortBy === 'distance') {
        mappedJobs.sort((a, b) => a.distance - b.distance);
      }
    }

    // Post-processing for rating-based sorting
    if (sortBy === 'rating_asc' || sortBy === 'rating_desc') {
      mappedJobs.sort((a, b) => {
        const ratingA =
          a.reviews && a.reviews.length > 0
            ? a.reviews.reduce((sum, review) => sum + review.rating, 0) /
              a.reviews.length
            : 0;
        const ratingB =
          b.reviews && b.reviews.length > 0
            ? b.reviews.reduce((sum, review) => sum + review.rating, 0) /
              b.reviews.length
            : 0;

        return sortBy === 'rating_asc' ? ratingA - ratingB : ratingB - ratingA;
      });
    }

    const totalPages = Math.ceil(total / limit);

    return {
      jobs: mappedJobs,
      total,
      totalPages,
      currentPage: page,
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Get a single job by ID
  async findOne(id: string): Promise<any> {
    const job = await this.prisma.job.findUnique({
      where: {
        id,
        status: 1,
        deleted_at: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
          },
        },
        requirements: true,
        notes: true,
        counter_offers: {
          include: {
            helper: {
              select: {
                id: true,
                name: true,
                first_name: true,
                last_name: true,
                email: true,
                phone: true,
              },
            },
          },
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
                phone: true,
              },
            },
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.mapToResponseDto(job);
  }

  // Get jobs posted by a specific user
  async findByUser(userId: string): Promise<{ jobs: any[]; total: number }> {
    const jobs = await this.prisma.job.findMany({
      where: {
        user_id: userId,
        status: 1,
        job_status: 'posted',
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
          },
        },
        requirements: true,
        notes: true,
        counter_offers: {
          include: {
            helper: {
              select: {
                id: true,
                name: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
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
              },
            },
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    const mappedJobs = jobs.map((job) => this.mapToResponseDto(job));

    return {
      jobs: mappedJobs,
      total: jobs.length,
    };
  }

  // Update a job
  async update(
    id: string,
    updateJobDto: any,
    userId: string,
    newPhotoPath?: string,
  ): Promise<any> {
    const existingJob = await this.prisma.job.findFirst({
      where: {
        id,
        user_id: userId,
        status: 1,
        job_status: { in: ['posted', 'counter_offer'] },
        deleted_at: null,
      },
    });

    if (!existingJob) {
      throw new NotFoundException(
        'Job not found or you do not have permission to update it',
      );
    }

    // Extract nested relations and basic fields
    const { requirements, notes, ...basicFields } = updateJobDto;

    // Map enums properly for update
    const mappedData: any = { ...basicFields };

    // Map category if provided
    if (basicFields.category) {
      mappedData.category = basicFields.category;
    }

    // Map payment_type if provided
    if (basicFields.payment_type) {
      mappedData.payment_type = basicFields.payment_type;
    }

    // Map job_type if provided
    if (basicFields.job_type) {
      mappedData.job_type = basicFields.job_type;
    }

    // Handle nested relations properly
    const updateData: any = {
      ...mappedData,
      ...(newPhotoPath ? { photos: newPhotoPath } : {}),
    };

    // Handle requirements if provided
    if (requirements && Array.isArray(requirements)) {
      updateData.requirements = {
        deleteMany: {}, // Delete existing requirements
        create: requirements.map((req: any) => ({
          title: req.title,
          description: req.description,
        })),
      };
    }

    // Handle notes if provided
    if (notes && Array.isArray(notes)) {
      updateData.notes = {
        deleteMany: {}, // Delete existing notes
        create: notes.map((note: any) => ({
          title: note.title,
          description: note.description,
        })),
      };
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
          },
        },
        requirements: true,
        notes: true,
        counter_offers: {
          include: {
            helper: {
              select: {
                id: true,
                name: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
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
              },
            },
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    return this.mapToResponseDto(job);
  }

  // Delete a job
  async remove(id: string, userId: string): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        user_id: userId,
        deleted_at: null,
        job_status: { not: { in: ['confirmed', 'ongoing','completed'] } },
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have permission to delete it',
      );
    }

    if(job.job_status==='confirmed' || job.job_status==='ongoing' || job.job_status==='completed'){
      throw new BadRequestException('Job is already in progress');
    }

    await this.prisma.job.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        status: 0,
      },
    });
  }

  public mapToResponseDto(job: any): any {
    // Handle accepted offer (either counter offer or direct assignment)
    const accepted =
      job.accepted_counter_offer ||
      (job.assigned_helper_id ? { helper: job.assigned_helper } : undefined);
    const hasCounterOffers =
      job.counter_offers && job.counter_offers.length > 0;

    return {
      id: job.id,
      title: job.title,
      category: job.category,
      start_time: job.start_time,
      end_time: job.end_time,
      price: job.price,
      final_price: job.final_price,
      payment_type: job.payment_type,
      job_type: job.job_type,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude,
      estimated_time: job.estimated_hours, // Return numeric hours
      description: job.description,
      requirements: job.requirements || [],
      notes: job.notes || [],
      urgent_note: job.urgent_note,
      photos: job.photos ? this.parsePhotos(job.photos) : [],
      user_id: job.user_id,
      created_at: job.created_at,
      updated_at: job.updated_at,
      job_status: job.job_status,
      current_status: job.job_status,
      user: job.user
        ? {
            id: job.user.id,
            name: job.user.name,
            email: job.user.email,
            avatar: job.user.avatar,
          }
        : null,
      counter_offers: job.counter_offers || [],
      accepted_offer: accepted
        ? {
            amount: Number(accepted.amount || job.final_price || job.price),
            type: job.payment_type, // Use the job's payment type (FIXED or HOURLY)
            note: accepted.note ?? undefined,
            helper: accepted.helper
              ? {
                  id: accepted.helper.id,
                  name:
                    accepted.helper.name ??
                    [accepted.helper.first_name, accepted.helper.last_name]
                      .filter(Boolean)
                      .join(' '),
                  email: accepted.helper.email ?? '',
                  phone: accepted.helper.phone ?? undefined,
                }
              : undefined,
          }
        : undefined,
    };
  }

  private parsePhotos(photosJson: string): string[] {
    try {
      const photos = JSON.parse(photosJson);
      if (Array.isArray(photos)) {
        return photos.map((photo) => SojebStorage.url(photo));
      }
      return [SojebStorage.url(photos)];
    } catch (error) {
      // If parsing fails, treat as single photo path
      return [SojebStorage.url(photosJson)];
    }
  }

  // Get job counts by category
  async getJobCountsByCategory(): Promise<any> {
    const categories = await this.prisma.category.findMany({
      where: {
        status: 1,
        deleted_at: null,
      },
      include: {
        _count: {
          select: {
            jobs: {
              where: {
                status: 1,
                deleted_at: null,
              },
            },
          },
        },
      },
      orderBy: { label: 'asc' },
    });
  
    const formatted = categories.map((category) => ({
      id: category.id,
      category: category.name,
      label: category.label,
      count: category._count.jobs,
    }));
    
    return {
      success: true,
      message: 'Category fetched successfully',
      data: formatted,
    };
  }
  
  /**
   * Cancel a job (User can cancel if status is 'confirmed')
   */
  async cancelJob(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        user_id: userId,
        job_status: { in: ['confirmed'] },
        deleted_at: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
            billing_id: true,
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have permission to cancel it',
      );
    }

    if (!['posted', 'confirmed'].includes(job.job_status)) {
      throw new BadRequestException(
        'Job cannot be cancelled in its current status',
      );
    }

    let refundResult: any = null;
    if (job.payment_intent_id) {
      const refundAmountCents = Math.round(Number(job.final_price || 0) * 100);
      try {
        refundResult = await this.stripeMarketplaceService.refundPaymentIntent({
          paymentIntentId: job.payment_intent_id,
          amountCents: refundAmountCents > 0 ? refundAmountCents : undefined,
          orderId: job.id,
          userId: job.user_id,
          customerId: job.user?.billing_id ?? undefined,
        });
      } catch (error) {
        throw new BadRequestException(
          `Refund failed: ${error.message ?? 'Unable to process refund'}`,
        );
      }
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        job_status: 'cancelled',
        status: 1,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // TODO: Send notification to helper via WebSocket
    // this.jobNotificationService.notifyJobCancelled(updatedJob);

    return {
      message: refundResult
        ? 'Job cancelled and payment refunded successfully'
        : 'Job cancelled successfully',
      job: this.mapToResponseDto(updatedJob),
      refund: refundResult
        ? {
            id: refundResult.id,
            status: refundResult.status,
            amount: refundResult.amount ? refundResult.amount / 100 : null,
            currency: refundResult.currency,
            created: refundResult.created ? new Date(refundResult.created * 1000) : null,
          }
        : null,
    };
  }

  // Helper methods for job creation
  private calculateHours(startTime: Date, endTime: Date): number {
    const diffInMs = endTime.getTime() - startTime.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return Math.round(diffInHours * 100) / 100; // Round to 2 decimal places
  }

  private formatEstimatedTime(hours: number): string {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours === 1) {
      return '1 hour';
    } else if (hours < 24) {
      return `${hours} hours`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
      } else {
        return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
    }
  }

  /**
   * Start a job (Helper can start if status is 'confirmed')
   */
  async startOrCompleteJob(jobId: string, helperId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        assigned_helper_id: helperId,
        // status: 1,
        deleted_at: null,
      },
      select:{
        job_status: true,
        actual_start_time: true,
        price: true,
        hourly_rate: true,
        payment_type: true,
        total_approved_hours: true,
      }
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you are not assigned to this job',
      );
    }

    try {
      if(job.job_status==='confirmed'){
        await this.prisma.jobTimeline.update({
          where:{job_id:jobId},
          data:{
            ongoing:new Date(),
          }
        })
        const updatedJob = await this.prisma.job.update({
          where: { id: jobId },
          data: {
            job_status: 'ongoing',
            actual_start_time: new Date(),
          },
        });
        
        return {
          success: true,
          message: 'Job started successfully',
          job: updatedJob,
        };
      }else{

        if (job.job_status !== 'ongoing') {
          throw new BadRequestException(
            'Job must be ongoing before you can complete it',
          );
        }
        await this.prisma.jobTimeline.update({
          where:{job_id:jobId},
          data:{
            completed:new Date(),
          }
        })
        
        if (job.payment_type === PaymentType.HOURLY) {
          const startTime = new Date(job.actual_start_time);
          const endTime = new Date();
          const actualHours = this.calculateHours(startTime, endTime);
    
          const approvedExtraHours=await this.prisma.job.findFirst({
            where:{
              id:jobId,
              extra_time_approved:true,
            },
            select:{
              total_approved_hours: true,
            }
          })

          const hourlyRate = Number(job.hourly_rate);
    
          const finalPrice = hourlyRate * (actualHours+Number(approvedExtraHours?.total_approved_hours||0));
         

          const updatedJob = await this.prisma.job.update({
            where: { id: jobId },
            data: {
              actual_start_time: startTime,
              actual_end_time: endTime,
              actual_hours: actualHours,
              job_status: 'completed',
              final_price: finalPrice,
            },
            select: {
              id: true,
              title: true,
              job_status: true,
              actual_start_time: true,
              actual_end_time: true,
              actual_hours: true,
              final_price: true,
              updated_at: true,
            },
          });
         
          return {
            success: true,
            message: 'Job completed successfully',
            updatedJob,
          };
        } else {
          const updatedJob = await this.prisma.job.update({
            where: { id: jobId },
            data: {
              job_status: 'completed',
              price: job.price,
              final_price: job.price,
              actual_end_time: new Date(),
            },
            select: {
              id: true,
              title: true,
              job_status: true,
              price: true,
              final_price: true,
              updated_at: true,
              actual_end_time: true,
            },
          });
          return {
            success: true,
            updatedJob,
          };
        }


      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to start job',
        error: error.message,
      };
    }
    
  }


// TODO: Change back to '0 * * * *' for production (runs every hour at minute 0)
@Cron('* * * * *') // Runs every minute for testing
async checkAndAutoCompleteJobs() {
  console.log('[CRON] Starting auto-complete job check at', new Date().toISOString());
  
  const TEST_MODE = true; // Set to false for production
  const now = new Date();
  const threshold = TEST_MODE 
    ? new Date(now.getTime() - 3 * 60 * 1000) // 3 minutes ago for testing
    : new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago for production

  // Process ALL eligible jobs - this is correct
  // First get all completed jobs with their timelines
  const jobs = await this.prisma.job.findMany({
    where: {
      job_status: 'completed',
      timeline: {
        isNot: null, // Ensure timeline exists
      },
    },
    select: { 
      id: true,
      timeline: {
        select: {
          completed: true,
          paid: true,
        },
      },
    },
  });

  // Filter jobs that meet the criteria
  const eligibleJobs = jobs.filter(job => {
    const timeline = job.timeline;
    if (!timeline || !timeline.completed) return false;
    if (timeline.paid) return false; // Already paid
    const completedDate = new Date(timeline.completed);
    return completedDate <= threshold;
  });

  console.log(`[CRON] Found ${eligibleJobs.length} eligible jobs to process (out of ${jobs.length} completed jobs)`);

  for (const job of eligibleJobs) {
    try {
      await this.autoCompleteJob(job.id);
    } catch (error) {
      console.error(`[CRON] Error processing job ${job.id}:`, error.message);
    }
  }
  
  console.log('[CRON] Finished auto-complete job check');
}

  /**
   * Auto-complete a single job - checks timing and marks as paid
   * @param jobId - The job ID to process
   */
  async autoCompleteJob(jobId: string): Promise<any> {
    console.log(`[AUTO-COMPLETE] Starting auto-complete for job: ${jobId}`);
    
    try {
      // Fetch job with timeline
      const job = await this.prisma.job.findFirst({
        where: { 
          id: jobId, 
          job_status: 'completed' 
        },
        select: {
          id: true,
          user_id: true,
          title: true,
          final_price: true,
          assigned_helper: {
            select: {
              id: true,
              stripe_connect_account_id: true,
            },
          },
          payment_intent_id: true,

          timeline: {
            select: {
              completed: true,
              paid: true,
              job_id: true,
            },
          },
        },
      });

      if (!job) {
        throw new NotFoundException(`Job ${jobId} not found or not completed`);
      }

      console.log(`[AUTO-COMPLETE] Job found: ${job.id} - "${job.title}"`);

      // Validate timeline exists
      if (!job.timeline) {
        throw new BadRequestException(`Job ${jobId} has no timeline record`);
      }

      console.log(`[AUTO-COMPLETE] Timeline found for job ${jobId}`);

      // Validate completion date exists
      if (!job.timeline.completed) {
        throw new BadRequestException(`Job ${jobId} has no completion date`);
      }

      // Check if already paid
      if (job.timeline.paid) {
        console.log(`[AUTO-COMPLETE] Job ${jobId} already marked as paid at: ${job.timeline.paid}`);
        return { 
          message: 'Job already paid',
          paidAt: job.timeline.paid 
        };
      }

      const completedAt = new Date(job.timeline.completed);
      const now = new Date();
      const hoursPassed = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
      const minutesPassed = (now.getTime() - completedAt.getTime()) / (1000 * 60);

      console.log(`[AUTO-COMPLETE] Job ${jobId} completed at: ${completedAt.toISOString()}`);
      console.log(`[AUTO-COMPLETE] Hours passed: ${hoursPassed.toFixed(2)}`);
      console.log(`[AUTO-COMPLETE] Minutes passed: ${minutesPassed.toFixed(2)}`);

      // Check if 24 hours have passed (or 3 minutes for testing - remove this for production)
      if ( minutesPassed >= 3) {
        console.log(`[AUTO-COMPLETE] ✅ Job ${jobId} eligible for auto-finish`);
        return await this.autofinishJob(jobId, job.user_id);
      }

      console.log(`[AUTO-COMPLETE] ⏳ Job ${jobId} not yet eligible (needs 24 hours, currently ${hoursPassed.toFixed(2)} hours)`);
      return { 
        message: 'Not yet 24 hours',
        hoursPassed: hoursPassed.toFixed(2),
        eligibleIn: (24 - hoursPassed).toFixed(2) + ' hours'
      };
      
    } catch (error) {
      console.error(`[AUTO-COMPLETE] ❌ Error in autoCompleteJob for ${jobId}:`, error.message);
      throw error;
    }
  }

  /**
   * Auto-finish a job - marks timeline as paid and updates job status
   * @param jobId - The job ID to finish
   * @param userId - The user ID who owns the job
   */
  async autofinishJob(jobId: string, userId: string): Promise<any> {
    console.log(`[AUTO-FINISH] Starting auto-finish for job: ${jobId}`);
    
    try {
      // STEP 1: Fetch job with all payment data first
      const job = await this.prisma.job.findFirst({
        where: { 
          id: jobId, 
          job_status: 'completed' 
        },
        select: {
          id: true,
          user_id: true,
          title: true,
          final_price: true,
          payment_intent_id: true,
          assigned_helper: {
            select: {
              id: true,
              stripe_connect_account_id: true,
            },
          },
        },
      });

      if (!job) {
        throw new NotFoundException(`Job ${jobId} not found`);
      }

      // STEP 2: Validate helper has Stripe account
      if (!job.assigned_helper?.stripe_connect_account_id) {
        throw new BadRequestException(`Helper has no Stripe Connect account for job ${jobId}`);
      }

      console.log(`[AUTO-FINISH] Job found: ${job.id} - "${job.title}"`);
      console.log(`[AUTO-FINISH] Helper Stripe account: ${job.assigned_helper.stripe_connect_account_id}`);

      // STEP 3: Compute amounts
      const total = Number(job.final_price || 0);
      
      if (total <= 0) {
        throw new BadRequestException(`Job ${jobId} has invalid final_price: ${total}`);
      }

      const platformFeePct = process.env.ADMIN_FEE; // or pull from settings
      const helperAmountCents = Math.round(total * (1 - Number(platformFeePct)) * 100);
      const commissionCents = Math.round(total * Number(platformFeePct) * 100);

      console.log(`[AUTO-FINISH] Processing payment:`);
      console.log(`  - Total: $${total}`);
      console.log(`  - Helper amount: $${(helperAmountCents / 100).toFixed(2)}`);
      console.log(`  - Platform commission: $${(commissionCents / 100).toFixed(2)}`);

      // STEP 4: Transfer helper share from platform balance
      let transfer;
      try {
        transfer = await this.stripeMarketplaceService.transferToHelper({
          jobId: job.id,
          finalPrice: total,
          helperStripeAccountId: job.assigned_helper.stripe_connect_account_id,
          platformFeePercent: Number(platformFeePct),
        });
        console.log(`[AUTO-FINISH] ✅ Payment transfer successful: ${transfer.id}`);
      } catch (paymentError) {
        console.error(`[AUTO-FINISH] ❌ Payment transfer failed:`, paymentError.message);
        throw new BadRequestException(`Payment transfer failed: ${paymentError.message}`);
      }

      // STEP 5: Persist payout/commission records
      try {
        await this.prisma.paymentTransaction.create({
          data: {
            provider: 'stripe',
            type: 'payout',
            reference_number: transfer.id,
            status: 'paid',
            amount: (helperAmountCents / 100).toFixed(2) as any,
            currency: 'usd',
            paid_amount: (helperAmountCents / 100).toFixed(2) as any,
            paid_currency: 'usd',
            user_id: job.assigned_helper.id, // receiver (helper)
            order_id: job.id,
          },
        });

        await this.prisma.paymentTransaction.create({
          data: {
            provider: 'stripe',
            type: 'commission',
            reference_number: job.payment_intent_id ?? undefined,
            status: 'captured',
            amount: (commissionCents / 100).toFixed(2) as any,
            currency: 'usd',
            paid_amount: (commissionCents / 100).toFixed(2) as any,
            paid_currency: 'usd',
            user_id: null, // platform
            order_id: job.id,
          },
        });
        console.log(`[AUTO-FINISH] ✅ Transaction records created`);
      } catch (transactionError) {
        console.error(`[AUTO-FINISH] ⚠️ Warning: Transaction records failed (payment already processed):`, transactionError.message);
        // Don't throw - payment succeeded, records are optional
      }

      // STEP 6: Update timeline to mark as paid (ONLY after payment succeeds)
      const timelineUpdate = await this.prisma.jobTimeline.update({
        where: { job_id: jobId },
        data: { 
          paid: new Date() 
        },
      });

      console.log(`[AUTO-FINISH] ✅ Timeline updated - paid at: ${timelineUpdate.paid?.toISOString()}`);

      // STEP 7: Update job status to 'paid' (ONLY after payment succeeds)
      const jobUpdate = await this.prisma.job.update({
        where: { id: jobId },
        data: {
          job_status: 'paid',
        },
        select: {
          id: true,
          job_status: true,
          title: true,
        },
      });

      console.log(`[AUTO-FINISH] ✅ Job ${jobId} status updated to: ${jobUpdate.job_status}`);
      console.log(`[AUTO-FINISH] ✅ Auto-finish completed successfully`);

      return {
        success: true,
        message: 'Job auto-finished successfully with payment processed',
        job: {
          id: jobUpdate.id,
          title: jobUpdate.title,
          status: jobUpdate.job_status,
        },
        timeline: {
          paidAt: timelineUpdate.paid,
        },
        payment: {
          transferId: transfer.id,
          helperAmount: (helperAmountCents / 100).toFixed(2),
          commissionAmount: (commissionCents / 100).toFixed(2),
        },
      };

    } catch (error) {
      console.error(`[AUTO-FINISH] ❌ Error in autofinishJob for ${jobId}:`, error.message);
      console.error(`[AUTO-FINISH] Error stack:`, error.stack);
      
      // Job is NOT marked as paid if we reach here
      // Payment failed, so status remains 'completed'
      throw error;
    }
  }

  /**
   * Finish a job (User can finish after helper marks as completed)
   */
  async finishJob(jobId: string, userId: string): Promise<any> {
    // First, check if job exists at all
    const jobExists = await this.prisma.job.findUnique({
      where: { id: jobId, job_status: 'completed',user_id:userId },
      select: {
        id: true,
        final_price: true,
        payment_intent_id: true,
        assigned_helper: { select: { id: true, stripe_connect_account_id: true } },
        title: true,
        user_id: true,
        status: true,
        deleted_at: true,
      },
    });



    if (!jobExists?.assigned_helper?.stripe_connect_account_id) {
      throw new BadRequestException('Helper has no Stripe Connect account.');
    }
    
    // 2) Compute amounts
    const total = Number(jobExists.final_price || 0);
    const platformFeePct = 0.10; // or pull from settings
    const helperAmountCents = Math.round(total * (1 - platformFeePct) * 100);
    const commissionCents = Math.round(total * platformFeePct * 100);
    
    // 3) Transfer helper share from platform balance
    const transfer = await this.stripeMarketplaceService.transferToHelper({
      jobId: jobExists.id,
      finalPrice: total,
      helperStripeAccountId: jobExists.assigned_helper.stripe_connect_account_id,
      platformFeePercent: platformFeePct,
    });
    
    // 4) Persist payout/commission records (optional but recommended)
    await this.prisma.paymentTransaction.create({
      data: {
        provider: 'stripe',
        type: 'payout',
        reference_number: transfer.id,
        status: 'paid',
        amount: (helperAmountCents / 100).toFixed(2) as any,
        currency: 'usd',
        paid_amount: (helperAmountCents / 100).toFixed(2) as any,
        paid_currency: 'usd',
        user_id: jobExists.assigned_helper.id, // receiver (helper)
        order_id: jobExists.id,
      },
    });
    // Optionally record commission as a row (if you track it separately)
    await this.prisma.paymentTransaction.create({
      data: {
        provider: 'stripe',
        type: 'commission',
        reference_number: jobExists.payment_intent_id ?? undefined,
        status: 'captured',
        amount: (commissionCents / 100).toFixed(2) as any,
        currency: 'usd',
        paid_amount: (commissionCents / 100).toFixed(2) as any,
        paid_currency: 'usd',
        user_id: jobExists.user_id, // platform
        order_id: jobExists.id,
      },
    });


    if (!jobExists) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Check if user owns the job
    if (jobExists.user_id !== userId) {
      throw new NotFoundException(
        'You do not have permission to finish this job',
      );
    }

    // Check if job is active
    // if (jobExists.status !== 1) {
    //   throw new BadRequestException('Job is not active');
    // }

    // Check if job is deleted
    if (jobExists.deleted_at) {
      throw new BadRequestException('Job has been deleted');
    }

    // Check job status
    if (jobExists.status !== 1) {
      throw new BadRequestException(
        `Job must be active before you can finish it. Current status: ${jobExists.status}`,
      );
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        job_status: 'paid',
        status: 0,
      },
      select:{
        id: true,
        title: true,
        job_status: true,
        actual_end_time: true,
        updated_at: true,
        user_id: true,
        final_price: true,
    payment_intent_id: true,
        assigned_helper: {
          select:{
            id: true,
            stripe_connect_account_id: true,
          }
        },
        actual_start_time: true,
        actual_hours: true,
        price: true,
      }
    });

    // TODO: Send notification to helper via WebSocket
    // this.jobNotificationService.notifyJobFinished(updatedJob);

    return {
      message: 'Job finished successfully',
      job:updatedJob,
    };
  }

   /**
   * Add extra time to an ongoing job
   */
   async requestExtraTime(
    jobId: string, 
    userId: string, 
    dto:RequestExtraTimeDto
  ): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        job_status: 'ongoing',
        payment_type:PaymentType.HOURLY,
      },
      select: {
        assigned_helper_id: true,
        user_id: true,
        job_status: true,
      }
    });
    
    if (!job) {
      throw new NotFoundException('Job not found or you do not have access to it');
    }
  
    if (job.job_status !== 'ongoing') {
      throw new BadRequestException('Job is not ongoing');
    }
  
    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        extra_time_requested: dto.hours, 
        extra_time_requested_at: new Date(),   
      }
    });
  
    return {
      success: true,
      message: 'Extra time request submitted successfully',
      job: updatedJob,
    };
  }
  
  async getJobStatus(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        OR: [{ user_id: userId }, { assigned_helper_id: userId }],
        status: 1,
        deleted_at: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar: true,
          },
        },
        assigned_helper: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have access to it',
      );
    }

    return this.mapToResponseDto(job);
  }
  /**
   * Approve extra time for a job
   */
  async approveOrDeclineExtraTime(jobId: string, userId: string, approved: boolean) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        user_id: userId,
        deleted_at: null,
        extra_time_requested: {
          not: null,
        },
      },
      include: {
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
      },
    });
  
    if (!job) {
      throw new NotFoundException('Job not found or you do not have permission');
    }
  
    if (!job.extra_time_requested) {
      throw new BadRequestException('No extra time request found');
    }
  
    if (approved) {
      const currentTotalHours = Number(job.total_approved_hours || 0);
      const newTotalHours = currentTotalHours + Number(job.extra_time_requested);
  
      const updatedJob = await this.prisma.job.update({
        where: {
          id: jobId,
          user_id: userId,
          deleted_at: null,
        },
        data: {
          extra_time_approved: true,
          extra_time_approved_at: new Date(),
          total_approved_hours: newTotalHours, 
        },
        select: {
          id: true,
          title: true,
          job_status: true,
          extra_time_requested: true,
          extra_time_approved: true,
          total_approved_hours: true,

        }
      });
      if (job.payment_type !== PaymentType.HOURLY) {
        throw new BadRequestException('Extra time is only applicable for hourly jobs');
      }

      const hourlyRate = Number(job.hourly_rate ?? 0);
      if (hourlyRate <= 0) {
        throw new BadRequestException('Hourly rate must be greater than zero to approve extra time');
      }

      const extraHours = Number(job.extra_time_requested);
      if (extraHours <= 0) {
        throw new BadRequestException('Requested extra time must be greater than zero');
      }

      const baseAmount = hourlyRate * extraHours;
      const {
        totalAmount,
      } = commisionSpillter(baseAmount);

      if (!job.user?.billing_id) {
        throw new BadRequestException('User does not have a valid billing profile');
      }

      const helperStripeAccountId = job.assigned_helper?.stripe_connect_account_id;
      if (!helperStripeAccountId) {
        throw new BadRequestException('Assigned helper is missing Stripe connect account');
      }

      const idempotencyKey = `pi_extra_${jobId}_${Math.round(baseAmount * 100)}`;
      let paymentIntent: Awaited<ReturnType<typeof this.stripeMarketplaceService.createMarketplacePaymentIntent>> | null = null;

      try {
        paymentIntent = await this.stripeMarketplaceService.createMarketplacePaymentIntent({
          jobId: jobId,
          finalPrice: totalAmount,
          buyerBillingId: job.user.billing_id,
          buyerUserId: job.user.id,
          helperStripeAccountId,
          jobTitle: job.title,
          idempotencyKey,
        });

        await this.stripeMarketplaceService.capturePaymentIntent(paymentIntent.payment_intent_id);
      } catch (error) {
        await this.prisma.job.update({
          where: { id: jobId },
          data: {
            extra_time_approved: false,
            extra_time_approved_at: null,
            total_approved_hours: currentTotalHours,
          },
        });
        throw new BadRequestException(
          `Failed to process payment for extra time: ${
            error?.message ?? 'Unknown error from payment provider'
          }`,
        );
      }

      return {
        success: true,
        message: 'Extra time approved successfully', 
        job: updatedJob,
        payment_intent_id: paymentIntent.payment_intent_id,
        idempotency_key: idempotencyKey,
      };
    } else {
      const updatedJob = await this.prisma.job.update({
        where: {
          id: jobId,
          user_id: userId,
          deleted_at: null,
        },
        data: {
          extra_time_approved: false,
          extra_time_approved_at: new Date(),
        },
        select: { 
          id: true,
          title: true,
          job_status: true,
          extra_time_requested: true,
          extra_time_approved: true,
          total_approved_hours: true,
        }
      });
  
      return {
        success: true,
        message: 'Extra time rejected successfully',
        job: updatedJob
      };
    }
  }


  async upcomingEvents(userId: string, userType: string): Promise<any> {
    if (!userId) {
      return new BadRequestException('User ID is required');
    }

    if (userType === 'user') {
      const jobs = await this.prisma.job.findFirst({
        where: {
          user_id: userId,
          NOT: { assigned_helper_id: null },
          job_status: { in: ['confirmed'] },
        },
    
        orderBy: {
          start_time: 'desc',
        },

        select:{
          id: true,
          title: true,
          start_time: true,
          end_time: true,
          job_status: true,
          final_price: true,
          location: true,
          latitude: true,
          longitude: true,
          description: true,
          assigned_helper: {
            select: {
              id: true,
              name: true,
              first_name: true,
              last_name: true,
              phone: true,
              
            },
          },
          timeline:{
            select: {
              id: true,
              posted: true,
              counter_offer: true,
              confirmed: true,
              ongoing: true,
              completed: true,
              paid: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
          user:{
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              avatar: true,
              cards: {
                where:{
                  is_default: true,
                },
                select: {
                  id: true,
                  last_four: true,
                  card_type: true,
                },
              },
            },
          },
          created_at: true,
          updated_at: true,
        },
      });
      return {
        message: 'upcoming appointments retrieved successfully',
        data: jobs,
      };
    } else if (userType === 'helper') {
      const jobs = await this.prisma.job.findFirst({
        where: {
          user_id: userId,
          NOT: { assigned_helper_id: null },
          job_status: { in: ['confirmed'] },
        },
    
        orderBy: {
          start_time: 'desc',
        },

        select:{
          id: true,
          title: true,
          start_time: true,
          end_time: true,
          job_status: true,
          final_price: true,
          location: true,
          latitude: true,
          longitude: true,
          description: true,
          assigned_helper: {
            select: {
              id: true,
              name: true,
              first_name: true,
              last_name: true,
              phone: true,
              
            },
          },
          timeline:{
            select: {
              id: true,
              posted: true,
              counter_offer: true,
              confirmed: true,
              ongoing: true,
              completed: true,
              paid: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
          user:{
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              avatar: true,
              cards: {
                where:{
                  is_default: true,
                },
                select: {
                  id: true,
                  last_four: true,
                  card_type: true,
                },
              },
            },
          },
          created_at: true,
          updated_at: true,
        },
      });
      return {
        message: 'upcoming appointments retrieved successfully',
        data: jobs,
      };
    } else {
      throw new BadRequestException('Invalid user type');
    }
  }
  
  async getTimeline(jobId: string): Promise<any> {
    const jobTimeline=await this.prisma.jobTimeline.findFirst({
      where: { job_id: jobId },
      select:{
        posted: true,
        counter_offer: true,
        confirmed: true,
        ongoing: true,
        completed: true,
        paid: true,
      }
    })

    if (!jobTimeline) {
      throw new NotFoundException('Job Timeline Not Found');
    }

    

    return {
      success: true,
      message: 'Timeline retrieved successfully',
      data: {
        jobTimeline
      },
    };
  }

  // Earnings and payments


  /**
   * Get weekly earnings with day-by-day breakdown
   */
  async getWeeklyEarnings(userId: string, userType: string): Promise<any> {
    const now = new Date();
    const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const currentDayOfWeek = utcToday.getUTCDay(); // 0 = Sunday, 6 = Saturday

    const currentWeekStart = new Date(utcToday);
    currentWeekStart.setUTCDate(utcToday.getUTCDate() - currentDayOfWeek);
    currentWeekStart.setUTCHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setUTCDate(currentWeekStart.getUTCDate() + 6);
    currentWeekEnd.setUTCHours(23, 59, 59, 999);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setUTCDate(currentWeekStart.getUTCDate() - 7);
    previousWeekStart.setUTCHours(0, 0, 0, 0);

    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setUTCDate(previousWeekStart.getUTCDate() + 6);
    previousWeekEnd.setUTCHours(23, 59, 59, 999);

    const buildWeekPayload = (
      weekStart: Date,
      weekJobs: Array<{ id: string; final_price: any; updated_at: Date }>,
    ) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayTotals = Array(7).fill(0);

      weekJobs.forEach((job) => {
        const jobDate = new Date(job.updated_at);
        const dayIndex = jobDate.getUTCDay();
        dayTotals[dayIndex] += Number(job.final_price ?? 0);
      });

      const chart = dayNames.map((dayName, index) => {
        const dayDate = new Date(weekStart);
        dayDate.setUTCDate(weekStart.getUTCDate() + index);
        dayDate.setUTCHours(0, 0, 0, 0);

        return {
          day: dayName,
          date: dayDate.toISOString(),
          amount: Math.round(dayTotals[index] * 100) / 100,
        };
      });

      const total = dayTotals.reduce((sum, value) => sum + value, 0);
      // const weekLabel = `${weekStart.toISOString().split('T')[0]}_${weekEnd
      //   .toISOString()
      //   .split('T')[0]}`;

      return {
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        total_earnings: Math.round(total * 100) / 100,
        chart,
      };
    };

    const fetchWeekJobs = async (start: Date, end: Date) => {
      const whereClause: any = {
        job_status: 'paid',
        updated_at: {
          gte: start,
          lte: end,
        },
      };

      if (userType === 'helper') {
        whereClause.assigned_helper_id = userId;
      } else {
        whereClause.user_id = userId;
      }

      return this.prisma.job.findMany({
        where: whereClause,
        select: {
          id: true,
          final_price: true,
          updated_at: true,
        },
      });
    };

    const [currentWeekJobs, previousWeekJobs] = await Promise.all([
      fetchWeekJobs(currentWeekStart, currentWeekEnd),
      fetchWeekJobs(previousWeekStart, previousWeekEnd),
    ]);

    const currentWeek = buildWeekPayload(currentWeekStart, currentWeekJobs);
    const previousWeek = buildWeekPayload(previousWeekStart, previousWeekJobs);

    return {
      success: true,
      message: 'Weekly earnings (current + previous) fetched successfully',
      currency: 'USD',
      data: {
        current_week: currentWeek,
        previous_week: previousWeek,
      },
    };
  }

  async getTimeTracking(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        OR: [{ user_id: userId }, { assigned_helper_id: userId }],
        status: 1,
        deleted_at: null,
      },
      select: {
        id: true,
        title: true,
        start_time: true,
        end_time: true,
        actual_start_time: true,
        actual_end_time: true,
        actual_hours: true,
        job_status: true,
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have access to it',
      );
    }

    return {
      job_id: job.id,
      title: job.title,
      scheduled_start: job.start_time,
      scheduled_end: job.end_time,
      actual_start: job.actual_start_time,
      actual_end: job.actual_end_time,
      actual_hours: job.actual_hours,
      status: job.job_status,
    };
  }
  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<{
    maxDistanceKm?: number;
    minJobPrice?: number;
    maxJobPrice?: number;
    preferredCategoryIds?: Array<{
      id: string;
      category: string;
      label: string;
    }>;
    latitude?: number;
    longitude?: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        max_distance_km: true,
        min_job_price: true,
        max_job_price: true,
        preferred_categories: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Convert category names to category details (id, name, label)
    let preferredCategoryIds: Array<{ id: string; category: string; label: string }> | undefined = undefined;
    if (user.preferred_categories && user.preferred_categories.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: {
          name: { in: user.preferred_categories as string[] },
        },
        select: {
          id: true,
          name: true,
          label: true,
        },
      });

      // Map category names to full category details
      const nameToCategoryMap = new Map(categories.map(c => [c.name, c]));
      preferredCategoryIds = (user.preferred_categories as string[])
        .map(name => nameToCategoryMap.get(name))
        .filter((cat): cat is { id: string; name: string; label: string } => cat !== undefined)
        .map(cat => ({
          id: cat.id,
          category: cat.name,
          label: cat.label,
        }));
    }

    return {
      maxDistanceKm: user.max_distance_km ? Number(user.max_distance_km) : undefined,
      // minJobPrice: user.min_job_price ? Number(user.min_job_price) : undefined,
      // maxJobPrice: user.max_job_price ? Number(user.max_job_price) : undefined,
      latitude: user.latitude ? Number(user.latitude) : undefined,
      longitude: user.longitude ? Number(user.longitude) : undefined,
      preferredCategoryIds: preferredCategoryIds && preferredCategoryIds.length > 0 
        ? preferredCategoryIds 
        : undefined,
    };
  }
  /**
   * Update helper preferences
   */
  async updateHelperPreferences(userId: string, dto: any): Promise<any> {
    let categoryNames: string[] | undefined = undefined;

    // Determine if we're receiving category IDs or names
    // Priority: preferredCategoryIds > preferredCategories
    let categoryIds: string[] | undefined = undefined;
    
    if (dto.preferredCategoryIds !== undefined && Array.isArray(dto.preferredCategoryIds)) {
      categoryIds = dto.preferredCategoryIds;
    } else if (dto.preferredCategories !== undefined && Array.isArray(dto.preferredCategories)) {
      // Check if preferredCategories contains IDs (CUID format) or names
      // CUIDs typically start with 'c' and are 25 characters long
      const mightBeIds = dto.preferredCategories.every((val: string) => 
        typeof val === 'string' && val.length >= 20 && val.match(/^[a-z0-9]{20,}$/i)
      );
      
      if (mightBeIds && dto.preferredCategories.length > 0) {
        // Check if these are valid category IDs
        const categoriesById = await this.prisma.category.findMany({
          where: {
            id: { in: dto.preferredCategories },
          },
          select: {
            id: true,
            name: true,
          },
        });
        
        // If we found categories by ID, treat them as IDs
        if (categoriesById.length > 0) {
          categoryIds = dto.preferredCategories;
        }
      }
    }

    // Process category IDs if we have them
    if (categoryIds !== undefined) {
      // Handle empty array - clear preferences
      if (categoryIds.length === 0) {
        categoryNames = [];
      } else {
        // Validate category IDs exist and get their names
        const categories = await this.prisma.category.findMany({
          where: {
            id: { in: categoryIds },
          },
          select: {
            id: true,
            name: true,
          },
        });

        // Check if all provided IDs are valid
        const foundIds = new Set(categories.map(c => c.id));
        const invalidIds = categoryIds.filter((id: string) => !foundIds.has(id));
        
        if (invalidIds.length > 0) {
          throw new Error(`Invalid category IDs: ${invalidIds.join(', ')}`);
        }

        // Convert IDs to names for storage
        const idToNameMap = new Map(categories.map(c => [c.id, c.name]));
        categoryNames = categoryIds
          .map((id: string) => idToNameMap.get(id))
          .filter((name): name is string => name !== undefined);
      }
    } else if (dto.preferredCategories !== undefined && Array.isArray(dto.preferredCategories)) {
      // Backward compatibility: if preferredCategories (names) are provided, use them
      if (dto.preferredCategories.length === 0) {
        categoryNames = [];
      } else {
        // Convert old enum values to new category names for backward compatibility
        categoryNames = dto.preferredCategories.map(
          (category: string) => {
            // Convert old enum values to new category names
            return convertEnumToCategoryName(category);
          },
        );

        // Validate category names against seeded categories
        const validCategories = await this.prisma.category.findMany({
          select: { name: true }
        });
        const validCategoryNames = validCategories.map(c => c.name);
        
        const invalidCategories = categoryNames.filter(
          (cat: string) => !validCategoryNames.includes(cat)
        );
        
        if (invalidCategories.length > 0) {
          throw new Error(`Invalid categories: ${invalidCategories.join(', ')}. Valid categories are: ${validCategoryNames.join(', ')}`);
        }
      }
    }

    // Update user preferences in database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        max_distance_km: dto.maxDistanceKm,
        min_job_price: dto.minJobPrice,
        max_job_price: dto.maxJobPrice,
        preferred_categories: categoryNames,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    // Fetch category details for response (same format as GET)
    let preferredCategoryIds: Array<{ id: string; category: string; label: string }> | undefined = undefined;
    if (categoryNames && categoryNames.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: {
          name: { in: categoryNames },
        },
        select: {
          id: true,
          name: true,
          label: true,
        },
      });

      // Map to the response format
      preferredCategoryIds = categories.map(cat => ({
        id: cat.id,
        category: cat.name,
        label: cat.label,
      }));
    }

    const updatedPreferences = {
      maxDistanceKm: dto.maxDistanceKm,
      latitude: dto.latitude,
      longitude: dto.longitude,
      preferredCategoryIds: preferredCategoryIds && preferredCategoryIds.length > 0 
        ? preferredCategoryIds 
        : undefined,
    };

    // Emit WebSocket event for real-time update
    try {
      this.notificationGateway.emitPreferencesUpdate(userId, updatedPreferences);
    } catch (error) {
      console.error('Failed to emit preferences update via WebSocket:', error);
      // Don't throw error, continue with response
    }

    return {
      success: true,
      message: 'Preferences updated successfully',
      data: updatedPreferences,
    };
  }
}
