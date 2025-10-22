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

@Injectable()
export class JobService {
  constructor(
    private prisma: PrismaService,
    private jobNotificationService: JobNotificationService,
    private geocodingService: GeocodingService,
    private categoryService: CategoryService,
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
      where: { name: jobData.category }
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
   */
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
  ): Promise<{ jobs: any[]; total: number; totalPages: number; currentPage: number }> {
    const { 
      category, categories, location, searchLat, searchLng, maxDistanceKm,
      jobType, paymentType, jobStatus, urgency,
      priceRange, minRating, maxRating,
      dateRange, search, sortBy 
    } = filters;
      const whereClause: any = {
      status: 1,
      deleted_at: null,
    };

    // Category filter (single category)
    if (category) {
        const categoryRecord = await (this.prisma as any).category.findUnique({
          where: { name: category }
        });
        
        if (categoryRecord) {
          whereClause.category_id = categoryRecord.id;
        } else {
          return { jobs: [], total: 0, totalPages: 0, currentPage: 1 };
        }
    }
    
    // Multiple categories filter
    if (categories && categories.length > 0) {
        const categoryRecords = await (this.prisma as any).category.findMany({
          where: { name: { in: categories } }
        });
        
        if (categoryRecords.length > 0) {
          whereClause.category_id = { in: categoryRecords.map(c => c.id) };
        } else {
          return { jobs: [], total: 0, totalPages: 0, currentPage: 1 };
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
    if (searchLat && searchLng && maxDistanceKm) {
        // This will be handled in post-processing since Prisma doesn't have built-in distance calculations
        // We'll filter by approximate bounding box first, then calculate exact distances
        const latRange = maxDistanceKm / 111; // Rough conversion: 1 degree ≈ 111 km
        const lngRange = maxDistanceKm / (111 * Math.cos(searchLat * Math.PI / 180));
        
        whereClause.latitude = {
          gte: searchLat - latRange,
          lte: searchLat + latRange,
        };
        whereClause.longitude = {
          gte: searchLng - lngRange,
          lte: searchLng + lngRange,
        };
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
              rating: ratingFilter
            }
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
                }
              }
            }
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
            distance: this.calculateDistance(searchLat, searchLng, job.latitude, job.longitude),
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
          const ratingA = a.reviews && a.reviews.length > 0 ? 
            a.reviews.reduce((sum, review) => sum + review.rating, 0) / a.reviews.length : 0;
          const ratingB = b.reviews && b.reviews.length > 0 ? 
            b.reviews.reduce((sum, review) => sum + review.rating, 0) / b.reviews.length : 0;
          
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
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
                  phone_number: true,
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
                    phone_number: true,
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
              phone_number: true,
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
          job_status:"posted",
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
        job_status:{in:["posted","counter_offer"]},
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
        status: 1,
        deleted_at: null,
        job_status:{not:{in:["confirm","completed","cancelled"]}}
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
                    phone_number: accepted.helper.phone_number ?? undefined,
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
      const categories = await (this.prisma as any).category.findMany({
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
                }
              }
            }
          }
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
    /**
     * Finish a job (User can finish after helper marks as completed)
     */
    async finishJob(jobId: string, userId: string): Promise<any> {
      // First, check if job exists at all
      const jobExists = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          user_id: true,
          job_status: true,
          status: true,
          deleted_at: true,
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
      if (jobExists.job_status !== 'completed_by_helper') {
        throw new BadRequestException(
          `Job must be completed by helper before you can finish it. Current status: ${jobExists.job_status}`,
        );
      }
  
      // Get full job data for update
    const job = await this.prisma.job.findFirst({
      where: {
          id: jobId,
            user_id: userId,
          status: 1,
            deleted_at: null,
        },
      });
  
      const updatedJob = await this.prisma.job.update({
        where: { id: jobId },
        data: {
          job_status: 'completed',
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
      // this.jobNotificationService.notifyJobFinished(updatedJob);
  
      return {
        message: 'Job finished successfully',
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
   * Add extra time to an ongoing job
   */
  async addExtraTime(
    jobId: string,
    userId: string,
    extraMinutes: number,
  ): Promise<any> {
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
        'Job not found or you do not have permission to modify it',
      );
    }

    if (job.job_status !== 'ongoing') {
      throw new BadRequestException(
        'Extra time can only be added to ongoing jobs',
      );
    }

    if (extraMinutes <= 0) {
      throw new BadRequestException('Extra time must be greater than 0');
    }

    // Calculate new end time
    const currentEndTime = new Date(job.end_time);
    const newEndTime = new Date(
      currentEndTime.getTime() + extraMinutes * 60 * 1000,
    );

    // Recalculate estimated hours
    const startTime = new Date(job.start_time);
    const newEstimatedHours = this.calculateHours(startTime, newEndTime);

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        end_time: newEndTime,
        estimated_hours: newEstimatedHours,
        estimated_time: this.formatEstimatedTime(newEstimatedHours),
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
    // this.jobNotificationService.notifyExtraTimeAdded(updatedJob, extraMinutes);

    return {
      message: `Added ${extraMinutes} minutes to the job`,
      job: this.mapToResponseDto(updatedJob),
    };
  }
  // Helper Actions (Helper Interface)
  /**
   * Start a job (Helper can start if status is 'confirmed')
   */
  async startJob(jobId: string, helperId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        assigned_helper_id: helperId,
        status: 1,
            deleted_at: null,
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you are not assigned to this job',
      );
    }

    if (job.job_status !== 'confirmed') {
      throw new BadRequestException(
        'Job must be confirmed before you can start it',
      );
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        job_status: 'ongoing',
        actual_start_time: new Date(), // Record when helper actually started
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

    // TODO: Send notification to user via WebSocket
    // this.jobNotificationService.notifyJobStarted(updatedJob);

    return {
      message: 'Job started successfully',
      job: this.mapToResponseDto(updatedJob),
    };
  }

  /**
   * Complete a job (Helper can complete if status is 'ongoing')
   */
  async completeJob(jobId: string, helperId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        assigned_helper_id: helperId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you are not assigned to this job',
      );
    }

    if (job.job_status !== 'ongoing') {
      throw new BadRequestException(
        'Job must be ongoing before you can complete it',
      );
    }

    const actualEndTime = new Date();
    const actualStartTime = job.actual_start_time || new Date(job.start_time);
    const actualHours = this.calculateHours(actualStartTime, actualEndTime);

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        job_status: 'completed_by_helper',
        actual_end_time: actualEndTime,
        actual_hours: actualHours,
        // Update final price if it's an hourly job
        final_price:
          job.payment_type === 'HOURLY'
            ? job.hourly_rate
              ? Number(job.hourly_rate) * actualHours
              : job.price
            : job.final_price || job.price,
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

    // TODO: Send notification to user via WebSocket
    // this.jobNotificationService.notifyJobCompleted(updatedJob);

    return {
      message: 'Job completed successfully. Waiting for user confirmation.',
      job: this.mapToResponseDto(updatedJob),
    };
  }
  /**
   * Get job status for timeline display
   */
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
   * Request extra time for a job
   */
    // async requestExtraTime(
    //   jobId: string,
    //   userId: string,
    //   requestDto: any,
    // ): Promise<any> {
    //   const job = await this.prisma.job.findFirst({
    //     where: { 
    //       id: jobId, 
    //       user_id: userId,
    //       status: 1, 
    //       deleted_at: null,
    //     },
    //   });
  
    //   if (!job) {
    //     throw new NotFoundException(
    //       'Job not found or you do not have permission to request extra time',
    //     );
    //   }
  
    //   if (job.job_status !== 'ongoing') {
    //     throw new BadRequestException(
    //       'Extra time can only be requested for ongoing jobs',
    //     );
    //   }
  
    //   // This would typically create a request record
    //   return {
    //     message: 'Extra time request submitted successfully',
    //     job_id: jobId,
    //     request: requestDto,
    //   };
    // }
  
    /**
     * Approve extra time for a job
     */
    // async approveExtraTime(
    //   jobId: string,
    //   userId: string,
    //   approvalDto: any,
    // ): Promise<any> {
    //   const job = await this.prisma.job.findFirst({
    //     where: { 
    //       id: jobId, 
    //       user_id: userId,
    //       status: 1, 
    //       deleted_at: null,
    //     },
    //   });
  
    //   if (!job) {
    //     throw new NotFoundException(
    //       'Job not found or you do not have permission to approve extra time',
    //     );
    //   }
  
    //   // This would typically update the request status
    //   return {
    //     message: 'Extra time request approved successfully',
    //     job_id: jobId,
    //     approval: approvalDto,
    //   };
    // }
  
    /**
     * Get extra time status for a job
     */
    // async getExtraTimeStatus(jobId: string, userId: string): Promise<any> {
    //   const job = await this.prisma.job.findFirst({
    //     where: { 
    //       id: jobId, 
    //       OR: [{ user_id: userId }, { assigned_helper_id: userId }],
    //       status: 1, 
    //       deleted_at: null,
    //     },
    //   });
  
    //   if (!job) {
    //     throw new NotFoundException(
    //       'Job not found or you do not have access to it',
    //     );
    //   }
  
    //   // This would typically return the current extra time request status
    //   return {
    //     job_id: jobId,
    //     status: 'no_request',
    //     message: 'No extra time requests found',
    //   };
    // }
  
  
  
  
  
  
    
    




    // Manage Jobs (User Interface)


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
                    phone_number: true,
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
              phone_number: true,
            },
          },
        },
      });

      // Parse photos for each job instead of using mapToResponseDto
      const jobsWithParsedPhotos = jobs.map(job => ({
        ...job,
        photos: job.photos ? this.parsePhotos(job.photos) : []
      }));
      
    return {
        message:"upcoming appointments retrieved successfully",
        data: jobsWithParsedPhotos
      }
      
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
            phone_number: true,
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
                    phone_number: true,
              },
            },
          },
        },
      },
    });

      // Parse photos for each job instead of using mapToResponseDto
      const jobsWithParsedPhotos = jobs.map(job => ({
        ...job,
        photos: job.photos ? this.parsePhotos(job.photos) : []
      }));
      
      return {
        message:"upcoming jobs retrieved successfully",
        data: jobsWithParsedPhotos
      }
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
    timelineEntries.forEach(entry => {
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
    const uniqueTimeline = timeline.filter((entry, index, self) => 
      index === self.findIndex(e => 
        e.status === entry.status && 
        new Date(e.timestamp).getTime() === new Date(entry.timestamp).getTime()
      )
    );

    uniqueTimeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      job_id: job.id,
      title: job.title,
      current_status: job.job_status,
      timeline: uniqueTimeline,
    };
  }

  // Earnings and payments


  /**
   * Get historical earnings
   */

  // async getHistoricalEarnings(
  //   userId: string,
  //   userType: string,
  //   period: string,
  //   days: number,
  // ): Promise<any> {
  //   const startDate = new Date();
  //   startDate.setDate(startDate.getDate() - days);

  //   const whereClause: any = {
  //     job_status: 'completed',
  //     status: 1,
  //     deleted_at: null,
  //     created_at: { gte: startDate },
  //   };

  //   if (userType === 'user') {
  //     whereClause.user_id = userId;
  //   } else if (userType === 'helper') {
  //     whereClause.OR = [
  //       { accepted_counter_offer: { helper_id: userId } },
  //       { assigned_helper_id: userId },
  //     ];
  //   }

  //   const jobs = await this.prisma.job.findMany({
  //     where: whereClause,
  //     select: {
  //       id: true,
  //       title: true,
  //       final_price: true,
  //       created_at: true,
  //       updated_at: true,
  //     },
  //   });

  //   const totalEarnings = jobs.reduce(
  //     (sum, job) => sum + Number(job.final_price || 0),
  //     0,
  //   );

  //   return {
  //     period,
  //     days,
  //     total_earnings: totalEarnings,
  //     job_count: jobs.length,
  //     jobs: jobs.map((job) => ({
  //       id: job.id,
  //       title: job.title,
  //       amount: Number(job.final_price || 0),
  //       completed_at: job.updated_at,
  //     })),
  //   };
  // }
  /**
   * Get weekly earnings
   */
  async getWeeklyEarnings(userId: string, userType: string): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const whereClause: any = {
      job_status: 'completed',
        status: 1, 
      deleted_at: null,
      created_at: { gte: startDate },
    };

    if (userType === 'user') {
      whereClause.user_id = userId;
    } else if (userType === 'helper') {
      whereClause.OR = [
        { accepted_counter_offer: { helper_id: userId } },
        { assigned_helper_id: userId },
      ];
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        final_price: true,
        created_at: true,
      },
    });

    const totalEarnings = jobs.reduce(
      (sum, job) => sum + Number(job.final_price || 0),
      0,
    );

    return {
      period: 'weekly',
      total_earnings: totalEarnings,
      job_count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        amount: Number(job.final_price || 0),
        date: job.created_at,
      })),
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
   * Update helper preferences
   */
  async updateHelperPreferences(userId: string, dto: any): Promise<any> {
    // Convert old enum values to new category names for backward compatibility
    if (dto.preferredCategories && Array.isArray(dto.preferredCategories)) {
      dto.preferredCategories = dto.preferredCategories.map((category: string) => {
        // Convert old enum values to new category names
        return convertEnumToCategoryName(category);
      });
    }

    // Update user preferences in database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        max_distance_km: dto.maxDistanceKm,
        min_job_price: dto.minJobPrice,
        max_job_price: dto.maxJobPrice,
        preferred_categories: dto.preferredCategories,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    return {
      message: 'Helper preferences updated successfully',
      userId,
      preferences: dto,
    };
  }
 

}
