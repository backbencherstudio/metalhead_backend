import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import { StripeMarketplaceService } from 'src/modules/payment/stripe/stripe-marketplace.service';

@Injectable()
export class JobService {
  constructor(
    private prisma: PrismaService,
    private jobNotificationService: JobNotificationService,
    private geocodingService: GeocodingService,
    private categoryService: CategoryService,
    private stripeMarketplaceService: StripeMarketplaceService,
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
    let location: string;

    // Priority 1: Use device GPS coordinates if provided
    if (jobData.latitude !== undefined && jobData.longitude !== undefined) {
      latitude = jobData.latitude;
      longitude = jobData.longitude;
      location = jobData.location || `Location: ${latitude}, ${longitude}`;
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
  async searchJobsWithValidation(rawParams: {
    // Raw query parameters
    page?: string;
    limit?: string;
    category?: string;
    categories?: string;
    location?: string;
    lat?: string;
    lng?: string;
    maxDistanceKm?: string;
    jobType?: string;
    paymentType?: string;
    jobStatus?: string;
    urgency?: string;
    minPrice?: string;
    maxPrice?: string;
    priceRange?: string;
    minRating?: string;
    maxRating?: string;
    dateRange?: string;
    createdAfter?: string;
    createdBefore?: string;
    search?: string;
    sortBy?: string;
  }, userId?: string): Promise<{
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
    let orderBy: any = { created_at: 'desc' }; // Default sorting

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
          orderBy = { created_at: 'desc' };
          break;
        case 'rating_desc':
          // Rating sorting will be handled in post-processing
          orderBy = { created_at: 'desc' };
          break;
        case 'distance':
          // Distance sorting will be handled in post-processing
          orderBy = { created_at: 'desc' };
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
            { created_at: 'desc' },
          ];
          break;
        case 'urgency_recent':
          // Combined sorting: URGENT jobs first, then by most recent
          orderBy = [
            { job_type: 'desc' }, // URGENT first (URGENT > ANYTIME)
            { created_at: 'desc' }, // Most recent first within each job type
          ];
          break;
        case 'created_at':
          orderBy = { created_at: 'desc' };
          break;
        default:
          orderBy = { created_at: 'desc' };
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
        job_status: { not: { in: ['confirm', 'completed', 'cancelled'] } },
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have permission to delete it',
      );
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
    // Get all categories with their job counts
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

    return categories.map((category) => ({
      category: category.name,
      label: category.label,
      count: category._count.jobs,
    }));
  }
  /**
   * Cancel a job (User can cancel if status is 'posted' or 'confirmed')
   */
  async cancelJob(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        user_id: userId,
        status: 1,
        deleted_at: null,
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

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        job_status: 'cancelled',
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
      message: 'Job cancelled successfully',
      job: this.mapToResponseDto(updatedJob),
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
        const updatedJob = await this.prisma.job.update({
          where: { id: jobId },
          data: {
            job_status: 'ongoing',
            actual_start_time: new Date(),
          },
        });
        return {
          message: 'Job started successfully',
          job: updatedJob,
        };
      }else{
      
        if (job.job_status !== 'ongoing') {
          throw new BadRequestException(
            'Job must be ongoing before you can complete it',
          );
        }
    
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
        user_id: null, // platform
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
    if (jobExists.status !== 1) {
      throw new BadRequestException('Job is not active');
    }

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
        status: 1,
        job_status: 'ongoing',
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
        status: 1,
        deleted_at: null,
        extra_time_requested: {
          not: null,
        },
      }
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
          status: 1,
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
  
      return {
        success: true,
        message: 'Extra time approved successfully',
        job: updatedJob
      };
    } else {
      const updatedJob = await this.prisma.job.update({
        where: {
          id: jobId,
          user_id: userId,
          status: 1,
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
      const jobs = await this.prisma.job.findMany({
        where: {
          user_id: userId,
          NOT: { assigned_helper_id: null },
          job_status: { in: ['confirmed', 'ongoing'] },
        },
        orderBy: {
          start_time: 'desc',
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
                  type: true,
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

      // Parse photos for each job instead of using mapToResponseDto
      const jobsWithParsedPhotos = jobs.map((job) => ({
        ...job,
        photos: job.photos ? this.parsePhotos(job.photos) : [],
      }));

      return {
        message: 'upcoming appointments retrieved successfully',
        data: jobsWithParsedPhotos,
      };
    } else if (userType === 'helper') {
      const jobs = await this.prisma.job.findMany({
        where: { assigned_helper_id: userId },
        orderBy: {
          start_time: 'desc',
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
        },
      });

      // Parse photos for each job instead of using mapToResponseDto
      const jobsWithParsedPhotos = jobs.map((job) => ({
        ...job,
        photos: job.photos ? this.parsePhotos(job.photos) : [],
      }));

      return {
        message: 'upcoming jobs retrieved successfully',
        data: jobsWithParsedPhotos,
      };
    } else {
      throw new BadRequestException('Invalid user type');
    }
  }
  
  async getTimeline(jobId: string): Promise<any> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        job_status: true,
        created_at: true,
        updated_at: true,
        actual_start_time: true,
        actual_end_time: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job Not Found');
    }

    // Get timeline entries from database
    const timelineEntries = await this.prisma.jobTimeline.findMany({
      where: { job_id: jobId },
      orderBy: { timestamp: 'asc' },
    });

    // Create timeline array
    const timeline = [];

    // Add job creation as first entry
    timeline.push({
      status: 'posted',
      timestamp: job.created_at,
    });

    // Add timeline entries from database
    timelineEntries.forEach((entry) => {
      timeline.push({
        status: entry.status,
        timestamp: entry.timestamp,
      });
    });

    // Add actual start time if available
    if (job.actual_start_time) {
      timeline.push({
        status: 'ongoing',
        timestamp: job.actual_start_time,
      });
    }

    // Add actual end time if available
    if (job.actual_end_time) {
      timeline.push({
        status: 'completed_by_helper',
        timestamp: job.actual_end_time,
      });
    }

    // Add current status if different from last entry
    const lastEntry = timeline[timeline.length - 1];
    if (lastEntry && lastEntry.status !== job.job_status) {
      timeline.push({
        status: job.job_status,
        timestamp: job.updated_at,
      });
    }

    // Remove duplicates and sort by timestamp
    const uniqueTimeline = timeline.filter(
      (entry, index, self) =>
        index ===
        self.findIndex(
          (e) =>
            e.status === entry.status &&
            new Date(e.timestamp).getTime() ===
              new Date(entry.timestamp).getTime(),
        ),
    );

    uniqueTimeline.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return {
      success: true,
      message: 'Timeline retrieved successfully',
      data: {
        job_id: job.id,
        title: job.title,
        current_status: job.job_status,
        timeline: uniqueTimeline,
      },
    };
  }

  // Earnings and payments


  /**
   * Get weekly earnings with day-by-day breakdown
   */
  async getWeeklyEarnings(userId: string, userType: string): Promise<any> {
    // Calculate the start of the week (Sunday 00:00:00)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    // End of the week (Saturday 23:59:59)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const whereClause: any = {
      job_status: 'paid', // Use 'paid' status as earnings are only realized when paid
      status: 1,
      deleted_at: null,
      updated_at: { gte: startOfWeek, lte: endOfWeek }, // When job was marked as paid
    };

    if (userType === 'user') {
      whereClause.user_id = userId;
    } else if (userType === 'helper') {
      whereClause.assigned_helper_id = userId;
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      select: {
        id: true,
        final_price: true,
        updated_at: true, // When the job was paid
      },
    });

    // Initialize day earnings map (Sun = 0, Mon = 1, ..., Sat = 6)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayEarnings: { [key: number]: number } = {};
    
    // CRITICAL: Initialize ALL 7 days with 0 to ensure full week structure
    // This ensures that even if helper signed up mid-week, all days are present
    for (let i = 0; i < 7; i++) {
      dayEarnings[i] = 0;
    }

    // Group earnings by day of week (only adds to days that have paid jobs)
    jobs.forEach((job) => {
      const jobDate = new Date(job.updated_at);
      const dayOfWeek = jobDate.getDay(); // 0 = Sunday, 6 = Saturday
      dayEarnings[dayOfWeek] += Number(job.final_price || 0);
    });

    // Calculate total earnings from all jobs in the week
    const totalEarnings = jobs.reduce(
      (sum, job) => sum + Number(job.final_price || 0),
      0,
    );

    // Calculate average daily earnings (total / 7 days of the week)
    // Always divide by 7 to get average per day of the week, regardless of when user signed up
    const averageDaily = totalEarnings / 7;

    // Build chart array - ALWAYS returns all 7 days (Sun → Sat) with 0 for missing days
    // Example: Helper signs up Wed → Returns: [Sun: 0, Mon: 0, Tue: 0, Wed: X, Thu: Y, Fri: Z, Sat: 0]
    const chart = dayNames.map((dayName, index) => ({
      day: dayName,
      amount: dayEarnings[index],
    }));

    return {
      summary: {
        total_earnings: totalEarnings,
        average_daily: Math.round(averageDaily * 100) / 100, // Round to 2 decimal places
        currency: 'USD',
      },
      chart: chart,
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
    preferredCategoryIds?: string[];
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

    // Convert category names to category IDs
    let preferredCategoryIds: string[] | undefined = undefined;
    if (user.preferred_categories && user.preferred_categories.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: {
          name: { in: user.preferred_categories as string[] },
        },
        select: {
          id: true,
          name: true,
        },
      });

      // Map category names to IDs
      const nameToIdMap = new Map(categories.map(c => [c.name, c.id]));
      preferredCategoryIds = (user.preferred_categories as string[])
        .map(name => nameToIdMap.get(name))
        .filter((id): id is string => id !== undefined);
    }

    return {
      maxDistanceKm: user.max_distance_km ? Number(user.max_distance_km) : undefined,
      // minJobPrice: user.min_job_price ? Number(user.min_job_price) : undefined,
      // maxJobPrice: user.max_job_price ? Number(user.max_job_price) : undefined,
      preferredCategoryIds: preferredCategoryIds && preferredCategoryIds.length > 0 
        ? preferredCategoryIds 
        : undefined,
      latitude: user.latitude ? Number(user.latitude) : undefined,
      longitude: user.longitude ? Number(user.longitude) : undefined,
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

    return {
      success: true,
      message: 'Preferences updated successfully',
      userId,
      preferences: {
        maxDistanceKm: dto.maxDistanceKm,
        preferredCategoryIds: dto.preferredCategoryIds,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    };
  }
}
