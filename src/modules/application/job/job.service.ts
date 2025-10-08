import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { JobNotificationService } from './job-notification.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';

@Injectable()
export class JobService {
  constructor(
    private prisma: PrismaService,
    private jobNotificationService: JobNotificationService,
    private geocodingService: GeocodingService
  ) { }

  async create(createJobDto: CreateJobDto, userId: string, photoPath?: string): Promise<JobResponseDto> {
    const { requirements, notes, ...jobData } = createJobDto;

    // Validate coordinates are provided (required from device GPS)
    if (!jobData.latitude || !jobData.longitude) {
      throw new Error('Latitude and longitude are required from device GPS');
    }

    console.log(`📍 Using device coordinates: (${jobData.latitude}, ${jobData.longitude})`);

    // Auto-generate address from coordinates if location not provided
    if (!jobData.location) {
      console.log(`🌍 Auto-generating address from coordinates`);
      try {
        const address = await this.geocodingService.reverseGeocode(jobData.latitude, jobData.longitude);
        if (address) {
          jobData.location = address;
          console.log(`✅ Address generated: "${address}"`);
        } else {
          console.log(`❌ Failed to generate address from coordinates`);
          jobData.location = `Location: ${jobData.latitude}, ${jobData.longitude}`;
        }
      } catch (error) {
        console.error(`❌ Error generating address:`, error.message);
        jobData.location = `Location: ${jobData.latitude}, ${jobData.longitude}`;
      }
    }

    console.log(`💾 Creating job with data:`, {
      location: jobData.location,
      latitude: jobData.latitude,
      longitude: jobData.longitude,
      title: jobData.title
    });

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
    
    // Use start_time as the main date_and_time for the job
    const jobDateTime = startTime;
    
    
    const job = await this.prisma.job.create({
      data: {
        title: jobData.title,
        category: jobData.category,
        date_and_time: jobDateTime,
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
        photos: photoPath,
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

    console.log(`✅ Job created successfully:`, {
      id: job.id,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude
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
    this.jobNotificationService.notifyHelpersAboutNewJob(job.id).catch(error => {
      console.error('Failed to notify helpers about new job:', error);
    });

    return this.mapToResponseDto(job);
  }

  async update(
    id: string,
    updateJobDto: UpdateJobDto,
    userId: string,
    newPhotoPath?: string,
  ): Promise<JobResponseDto> {
    const existingJob = await this.prisma.job.findFirst({
      where: {
        id,
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!existingJob) {
      throw new NotFoundException(
        'Job not found or you do not have permission to update it',
      );
    }

    const { requirements, notes, ...jobData } = updateJobDto as any;

    // Replace photo if a new one is provided
    if (newPhotoPath) {
      if (existingJob.photos) {
        try {
          await SojebStorage.delete(existingJob.photos);
        } catch { }
      }
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: {
        ...jobData,
        ...(newPhotoPath ? { photos: newPhotoPath } : {}),
        ...(requirements
          ? {
            requirements: {
              deleteMany: {},
              create: requirements.map((req: any) => ({
                title: req.title,
                description: req.description,
              })),
            },
          }
          : {}),
        ...(notes
          ? {
            notes: {
              deleteMany: {},
              create: notes.map((note: any) => ({
                title: note.title,
                description: note.description,
              })),
            },
          }
          : {}),
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

    
    return this.mapToResponseDto(job);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    category?: string,
    location?: string,
    jobType?: string,
    priceRange?: { min: number, max: number },
    sortBy?: string, // added sorting logic
    search?: string, // search in title and description
    urgency?: string, // filter by urgency: 'urgent' or 'normal'
  ): Promise<{ jobs: JobResponseDto[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = {
      status: 1,
      deleted_at: null,
    };

    if (category) {
      where.category = category;
    }

    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    if (jobType) {
      where.job_type = jobType;
    }

    if (priceRange) {
      where.price = {
        gte: priceRange.min,
        lte: priceRange.max,
      };
    }

    // Add job type filtering
    if (jobType) {
      if (jobType === 'URGENT') {
        where.job_type = 'URGENT';
      } else if (jobType === 'ANYTIME') {
        where.job_type = 'ANYTIME';
      }
    }

    // Add urgency filtering (based on urgent_note)
    if (urgency) {
      if (urgency === 'urgent') {
        where.urgent_note = {
          not: null,
        };
      } else if (urgency === 'normal') {
        where.urgent_note = null;
      }
    }

    // Add search functionality
    if (search) {
      where.OR = [
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

    const orderBy: any = (() => {
      switch (sortBy) {
        case 'price_asc':
          return { price: 'asc' as const };
        case 'price_desc':
          return { price: 'desc' as const };
        case 'location':
          return { location: 'asc' as const };
        case 'location_desc':
          return { location: 'desc' as const };
        case 'title':
          return { title: 'asc' as const };
        case 'urgency':
          return { urgent_note: 'desc' as const };
        default:
          return { created_at: 'desc' as const };
      }
    })();


    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
      this.prisma.job.count({ where }),
    ]);


    const totalPages = Math.ceil(total / limit);

    return {
      jobs: jobs.map((job) => this.mapToResponseDto(job)),
      total,
      totalPages,
    };
  }


  async findOne(id: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        status: 1,
        deleted_at: null,
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
        // Include counter offers and accepted offer
        counter_offers: {
          include: {
            helper: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        accepted_offers: {
          include: {
            counter_offer: {
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
        }, // Get the accepted counter offer details with helper contact
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.mapToResponseDto(job);
  }

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          user_id: userId,
          status: 1,
          deleted_at: null,
        },
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          requirements: true,
          notes: true,
        },
      }),
      this.prisma.job.count({
        where: {
          user_id: userId,
          status: 1,
          deleted_at: null,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      jobs: jobs.map((job) => this.mapToResponseDto(job)),
      total,
      totalPages,
    };
  }



  async completeJob(id: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        status: 1,
        deleted_at: null,
      },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Check if the user is either the job owner or the helper
    const isJobOwner = job.user_id === userId;
    const isHelper = job.accepted_offers.some(
      offer => offer.counter_offer.helper_id === userId
    );

    console.log('Complete Job Debug:', {
      userId,
      jobUserId: job.user_id,
      isJobOwner,
      isHelper,
      acceptedOffers: job.accepted_offers.map(offer => ({
        counterOfferId: offer.counter_offer_id,
        helperId: offer.counter_offer?.helper_id
      }))
    });

    if (!isJobOwner && !isHelper) {
      throw new ForbiddenException('Only job participants can mark job as completed');
    }

    // Check if job has an accepted offer
    if (!job.accepted_offers || job.accepted_offers.length === 0) {
      throw new BadRequestException('Job must have an accepted offer to be completed');
    }

    // Check if job is in confirmed or ongoing status
    if (job.job_status !== 'confirmed' && job.job_status !== 'ongoing') {
      throw new BadRequestException('Job must be confirmed/started before it can be completed');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = { 
        job_status: 'completed' 
      };
      
      // If it's an hourly job, calculate actual time and final price
      if (job.payment_type === 'HOURLY' && job.actual_start_time) {
        const endTime = new Date();
        const actualHours = this.calculateHours(job.actual_start_time, endTime);
        const hourlyRate = job.hourly_rate || job.price;
        
        // Calculate final price based on approved hours vs actual hours
        let finalPrice;
        let approvedHours = job.estimated_hours ? parseFloat(job.estimated_hours.toString()) : 0;
        
        // If extra time was approved, use total approved hours as the base
        if (job.extra_time_approved && job.total_approved_hours) {
          approvedHours = parseFloat(job.total_approved_hours.toString());
        }
        
        // Calculate final price: guaranteed minimum + overtime only
        if (actualHours <= approvedHours) {
          // Within or under estimated time, charge for estimated hours (guaranteed minimum)
          finalPrice = approvedHours * parseFloat(hourlyRate.toString());
        } else {
          // Overtime beyond estimated time, charge for actual hours worked
          finalPrice = actualHours * parseFloat(hourlyRate.toString());
        }
        
        updateData.actual_end_time = endTime;
        updateData.actual_hours = actualHours;
        updateData.final_price = finalPrice;
      }
      
      await tx.job.update({
        where: { id },
        data: updateData,
      });

      await (tx as any).jobStatusHistory?.create({
        data: {
          job_id: id,
          status: 'completed',
          occurred_at: new Date(),
        },
      });
    });

    // Return time tracking data for hourly jobs
    if (job.payment_type === 'HOURLY') {
      return await this.getTimeTracking(id, userId);
    }

    // For non-hourly jobs, return simple success message
    return {
      message: 'Job marked as completed successfully',
      job_status: 'completed'
    };
  }

  async finishJob(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        status: 1,
        deleted_at: null,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.user_id !== userId) {
      throw new ForbiddenException('Only job owner can finish the job');
    }

    await this.prisma.job.update({
      where: { id },
      data: {
        job_status: 'paid',
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Job marked as finished successfully',
    };
  }

  async autoCompleteJob(id: string): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        status: 1,
        deleted_at: null,
        job_status: 'completed',
      },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found or not in completed status');
    }

    // Check if 24 hours have passed since job was completed
    const completedTime = job.updated_at;
    const now = new Date();
    const hoursSinceCompletion = (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCompletion < 24) {
      throw new BadRequestException('Job cannot be auto-completed yet. 24 hours must pass since completion.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id },
        data: {
          job_status: 'paid',
        },
      });

      await (tx as any).jobStatusHistory?.create({
        data: {
          job_id: id,
          status: 'auto_paid',
          occurred_at: new Date(),
        },
      });
    });

    // TODO: Add escrow payment release logic here
    console.log(`Auto-payment released for job ${id} to helper ${job.accepted_offers[0].counter_offer.helper_id}`);
  }

  async startJob(id: string, userId: string): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: { id, status: 1, deleted_at: null },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) throw new NotFoundException('Job not found');

    const isJobOwner = job.user_id === userId;
    const isHelper = job.accepted_offers.some(
      offer => offer.counter_offer.helper_id === userId
    );

    if (!isJobOwner && !isHelper) {
      throw new ForbiddenException('Only job participants can start the job');
    }

    if (job.job_status !== 'confirmed') {
      throw new BadRequestException('Job must be confirmed to start');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = { 
        job_status: 'ongoing' 
      };
      
      // If it's an hourly job, record actual start time
      if (job.payment_type === 'HOURLY') {
        updateData.actual_start_time = new Date();
      }
      
      await tx.job.update({ 
        where: { id }, 
        data: updateData 
      });
      
      await (tx as any).jobStatusHistory?.create({
        data: { job_id: id, status: 'started', occurred_at: new Date() },
      });
    });
  }

  async getTimeline(jobId: string) {
    // returns ordered timeline entries
    const entries = await (this.prisma as any).jobStatusHistory?.findMany({
      where: { job_id: jobId },
      orderBy: { occurred_at: 'asc' },
    }).catch?.(() => [] as any[]);

    // In case prisma client hasn't been generated yet or table empty
    const stored = Array.isArray(entries) ? entries : [];

    // Also load base entities for synthesis
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deleted_at: null },
      include: {
        counter_offers: true,
        accepted_offers: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');

    const result: { status: string; time: Date; meta?: any }[] = [];

    for (const h of stored) {
      result.push({ status: h.status, time: h.occurred_at, meta: h.meta ?? undefined });
    }

    if (!result.some(e => e.status === 'posted') && job.created_at) {
      result.push({ status: 'posted', time: job.created_at });
    }

    if (!result.some(e => e.status === 'counter_offer') && job.counter_offers?.length) {
      const firstCO = [...job.counter_offers].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      if (firstCO?.created_at) result.push({ status: 'counter_offer', time: firstCO.created_at, meta: { counter_offer_id: firstCO.id } });
    }

    const accepted = job.accepted_offers && job.accepted_offers[0];
    if (!result.some(e => e.status === 'confirmed') && (accepted as any)?.created_at) {
      result.push({ status: 'confirmed', time: (accepted as any).created_at, meta: { accepted_offer_id: (accepted as any).id } });
    }

    if (job.job_status === 'completed' && !result.some(e => e.status === 'completed')) {
      const completedTime = job.updated_at ?? new Date();
      result.push({ status: 'completed', time: completedTime });
    }

    result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return result;
  }

  async remove(id: string, userId: string): Promise<void> {
    const existingJob = await this.prisma.job.findFirst({
      where: {
        id,
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!existingJob) {
      throw new NotFoundException('Job not found or you do not have permission to delete it');
    }

    await this.prisma.job.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        status: 0,
      },
    });
  }


  async testGeocoding(address: string): Promise<{ lat: number; lng: number } | null> {
    return await this.geocodingService.geocodeAddress(address);
  }


  /**
   * Get jobs near user location (works for both user and helper roles)
   * This allows users to browse jobs in their area regardless of their current role
   */
  async getJobsNearUser(
    userId: string,
    radiusKm: number = 20,
    page: number = 1,
    limit: number = 10,
    category?: string,
  ): Promise<{ jobs: JobResponseDto[]; total: number; page: number; limit: number; radius: number }> {
    console.log(`🔍 Getting jobs near user: ${userId}, radius: ${radiusKm}km`);

    // Get user's location
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
        type: true,
      },
    });

    console.log(`👤 User found:`, {
      id: user?.id,
      latitude: user?.latitude,
      longitude: user?.longitude,
      city: user?.city,
      state: user?.state,
      type: user?.type
    });

    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    // If user doesn't have coordinates, we can't do distance-based search
    if (!user.latitude || !user.longitude) {
      console.log(`⚠️ User ${userId} doesn't have coordinates, falling back to city/state search`);

      // Fallback to city/state based search
      const whereClause: any = {
        job_status: 'posted',
        deleted_at: null,
      };

      if (category) {
        whereClause.category = category;
      }

      if (user.city && user.state) {
        whereClause.OR = [
          { location: { contains: user.city, mode: 'insensitive' } },
          { location: { contains: user.state, mode: 'insensitive' } },
        ];
      }

      const [jobs, total] = await Promise.all([
        this.prisma.job.findMany({
          where: whereClause,
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
            counter_offers: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
            accepted_offers: {
              include: {
                counter_offer: {
                  include: {
                    helper: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        phone_number: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.job.count({ where: whereClause }),
      ]);

      return {
        jobs: jobs.map(job => this.mapToResponseDto(job)),
        total,
        page,
        limit,
        radius: radiusKm,
      };
    }

    // Distance-based search using coordinates
    const jobs = await this.prisma.job.findMany({
      where: {
        job_status: 'posted',
        deleted_at: null,
        latitude: { not: null },
        longitude: { not: null },
        ...(category && { category }),
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
        counter_offers: {
          include: {
            helper: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone_number: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Filter jobs by distance
    const jobsWithinRadius = jobs.filter(job => {
      if (!job.latitude || !job.longitude) return false;

      const distance = this.calculateDistance(
        user.latitude!,
        user.longitude!,
        job.latitude,
        job.longitude,
      );

      return distance <= radiusKm;
    });

    // Apply pagination
    const total = jobsWithinRadius.length;
    const paginatedJobs = jobsWithinRadius.slice((page - 1) * limit, page * limit);

    return {
      jobs: paginatedJobs.map(job => this.mapToResponseDto(job)),
      total,
      page,
      limit,
      radius: radiusKm,
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private mapToResponseDto(job: any): JobResponseDto {
    const accepted = job.accepted_offers && job.accepted_offers.length ? job.accepted_offers[0] : undefined;
    const hasCounterOffers = job.counter_offers && job.counter_offers.length > 0;

    // Determine current status based on actual state
    let current_status = job.job_status; // Start with the actual job_status from database

    // Override with calculated status only if needed
    if (accepted) {
      current_status = 'confirmed';
    } else if (hasCounterOffers) {
      current_status = 'counter_offer';
    } else {
      current_status = 'posted';
    }

    
    return {
      id: job.id,
      title: job.title,
      category: job.category,
      date_and_time: job.date_and_time,
      price: job.price,
      payment_type: job.payment_type,
      job_type: job.job_type,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude,
      estimated_time: job.estimated_time,
      description: job.description,
      requirements: job.requirements || [],
      notes: job.notes || [],
      urgent_note: job.urgent_note,
      photos: job.photos ? SojebStorage.url(job.photos) : null,
      user_id: job.user_id,
      created_at: job.created_at,
      updated_at: job.updated_at,
      job_status: job.job_status,
      current_status,
      accepted_offer: accepted
        ? {
          amount: Number(accepted.counter_offer.amount),
          type: accepted.counter_offer.type,
          note: accepted.counter_offer.note ?? undefined,
          helper: {
            id: accepted.counter_offer.helper.id,
            name:
              accepted.counter_offer.helper.name ??
              [accepted.counter_offer.helper.first_name, accepted.counter_offer.helper.last_name]
                .filter(Boolean)
                .join(' '),
            email: accepted.counter_offer.helper.email ?? '',
            phone_number: accepted.counter_offer.helper.phone_number ?? undefined,
          },
        }
        : undefined,
    };
  }

  async updateHelperPreferences(userId: string, preferences: any): Promise<void> {
    await this.jobNotificationService.updateHelperPreferences(userId, preferences);
  }

  // Add this method to src/modules/application/job/job.service.ts before the closing brace

  async getJobCountsByCategory() {
    const categories = await this.prisma.job.groupBy({
      by: ['category'],
      where: {
        job_status: 'posted',
        deleted_at: null,
        status: 1
      },
      _count: {
        category: true
      }
    });

    return categories.map(cat => ({
      category: cat.category,
      count: cat._count.category
    }));
  }

  async getUpcomingAppointments(userId: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [
          // Jobs posted by the user
          {
            user_id: userId,
            job_status: { in: ['confirmed', 'ongoing'] },
            deleted_at: null,
            status: 1
          },
          // Jobs where user is the helper (accepted offers)
          {
            accepted_offers: {
              some: {
                counter_offer: {
                  helper_id: userId
                }
              }
            },
            job_status: { in: ['confirmed', 'ongoing'] },
            deleted_at: null,
            status: 1
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            avatar: true
          }
        },
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { date_and_time: 'asc' }
    });

    return jobs.map(job => this.mapToResponseDto(job));
  }

  async getPastAppointments(userId: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [
          // Jobs posted by the user
          {
            user_id: userId,
            job_status: { in: ['completed', 'paid'] },
            deleted_at: null,
            status: 1
          },
          // Jobs where user is the helper (accepted offers)
          {
            accepted_offers: {
              some: {
                counter_offer: {
                  helper_id: userId
                }
              }
            },
            job_status: { in: ['completed', 'paid'] },
            deleted_at: null,
            status: 1
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            avatar: true
          }
        },
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { updated_at: 'desc' }
    });

    return jobs.map(job => this.mapToResponseDto(job));
  }

  async getHelperUpcomingAppointments(helperId: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        accepted_offers: {
          some: {
            counter_offer: {
              helper_id: helperId
            }
          }
        },
        job_status: { in: ['confirmed', 'ongoing'] },
        deleted_at: null,
        status: 1
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            avatar: true
          }
        },
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { date_and_time: 'asc' }
    });

    return jobs.map(job => this.mapToResponseDto(job));
  }

  async getHelperPastAppointments(helperId: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        accepted_offers: {
          some: {
            counter_offer: {
              helper_id: helperId
            }
          }
        },
        job_status: { in: ['completed', 'paid'] },
        deleted_at: null,
        status: 1
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            avatar: true
          }
        },
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { updated_at: 'desc' }
    });

    return jobs.map(job => this.mapToResponseDto(job));
  }

  async getHistoricalEarnings(userId: string, userType: string, period: string = 'week', days: number = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    let whereClause: any = {
      job_status: 'completed',
      deleted_at: null,
      status: 1,
      updated_at: {
        gte: startDate,
        lte: endDate
      }
    };

    if (userType === 'helper') {
      whereClause.accepted_offers = {
        some: {
          counter_offer: {
            helper_id: userId
          }
        }
      };
    } else {
      whereClause.user_id = userId;
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      select: {
        id: true,
        final_price: true,
        updated_at: true,
        created_at: true
      },
      orderBy: { updated_at: 'asc' }
    });

    // Group earnings by day
    const earningsByDay = new Map();
    
    // Initialize all days with 0 earnings
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      earningsByDay.set(dateKey, {
        date: dateKey,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        earnings: 0,
        job_count: 0
      });
    }

    // Add actual earnings
    jobs.forEach(job => {
      const dateKey = job.updated_at.toISOString().split('T')[0];
      if (earningsByDay.has(dateKey)) {
        const dayData = earningsByDay.get(dateKey);
        dayData.earnings += Number(job.final_price || 0);
        dayData.job_count += 1;
      }
    });

    return {
      period,
      days,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_earnings: jobs.reduce((sum, job) => sum + Number(job.final_price || 0), 0),
      total_jobs: jobs.length,
      daily_breakdown: Array.from(earningsByDay.values())
    };
  }

  async getWeeklyEarnings(userId: string, userType: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    let whereClause: any = {
      job_status: 'completed',
      deleted_at: null,
      status: 1,
      updated_at: {
        gte: startDate,
        lte: endDate
      }
    };

    if (userType === 'helper') {
      whereClause.accepted_offers = {
        some: {
          counter_offer: {
            helper_id: userId
          }
        }
      };
    } else {
      whereClause.user_id = userId;
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      select: {
        id: true,
        final_price: true,
        updated_at: true
      },
      orderBy: { updated_at: 'asc' }
    });

    // Group by day of week
    const weeklyData = {
      Sunday: { earnings: 0, jobs: 0 },
      Monday: { earnings: 0, jobs: 0 },
      Tuesday: { earnings: 0, jobs: 0 },
      Wednesday: { earnings: 0, jobs: 0 },
      Thursday: { earnings: 0, jobs: 0 },
      Friday: { earnings: 0, jobs: 0 },
      Saturday: { earnings: 0, jobs: 0 }
    };

    jobs.forEach(job => {
      const dayName = job.updated_at.toLocaleDateString('en-US', { weekday: 'long' });
      if (weeklyData[dayName]) {
        weeklyData[dayName].earnings += Number(job.final_price || 0);
        weeklyData[dayName].jobs += 1;
      }
    });

    return {
      week_start: startDate.toISOString().split('T')[0],
      week_end: endDate.toISOString().split('T')[0],
      total_earnings: jobs.reduce((sum, job) => sum + Number(job.final_price || 0), 0),
      total_jobs: jobs.length,
      daily_breakdown: Object.entries(weeklyData).map(([day, data]) => ({
        day: day.substring(0, 3), // Sun, Mon, Tue, etc.
        full_day: day,
        earnings: data.earnings,
        job_count: data.jobs
      }))
    };
  }

  async getAllJobsForUser(userId: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [
          // Jobs posted by the user
          {
            user_id: userId,
            deleted_at: null,
            status: 1
          },
          // Jobs where user is the helper (accepted offers)
          {
            accepted_offers: {
              some: {
                counter_offer: {
                  helper_id: userId
                }
              }
            },
            deleted_at: null,
            status: 1
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: {
                  select: {
                    id: true,
                    name: true,
                    first_name: true,
                    last_name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return jobs.map(job => ({
      id: job.id,
      title: job.title,
      job_status: job.job_status,
      user_id: job.user_id,
      user_name: job.user?.name || `${job.user?.first_name} ${job.user?.last_name}`.trim(),
      has_accepted_offer: job.accepted_offers?.length > 0,
      helper_id: job.accepted_offers?.[0]?.counter_offer?.helper_id,
      helper_name: job.accepted_offers?.[0]?.counter_offer?.helper?.name || 
                   `${job.accepted_offers?.[0]?.counter_offer?.helper?.first_name} ${job.accepted_offers?.[0]?.counter_offer?.helper?.last_name}`.trim(),
      created_at: job.created_at,
      updated_at: job.updated_at,
      date_and_time: job.date_and_time
    }));
  }

  // Time tracking helper methods for hourly jobs
  private calculateHours(startTime: Date, endTime: Date): number {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
  }


  private validateHourlyJob(job: any): void {
    if (job.payment_type === 'HOURLY') {
      if (!job.hourly_rate && !job.price) {
        throw new BadRequestException('Hourly rate must be specified for hourly jobs');
      }
    }
  }

  private formatEstimatedTime(hours: number): string {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minutes`;
    } else if (hours === 1) {
      return '1 hour';
    } else if (hours < 24) {
      // Convert decimal hours to hours and minutes
      const wholeHours = Math.floor(hours);
      const decimalMinutes = (hours - wholeHours) * 60;
      const roundedMinutes = Math.round(decimalMinutes);
      
      if (roundedMinutes === 0) {
        return `${wholeHours} hours`;
      } else if (wholeHours === 0) {
        return `${roundedMinutes} minutes`;
      } else {
        return `${wholeHours} hour${wholeHours > 1 ? 's' : ''} and ${roundedMinutes} minutes`;
      }
    } else {
      // For 24+ hours, show days and hours
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      const wholeRemainingHours = Math.floor(remainingHours);
      const decimalMinutes = (remainingHours - wholeRemainingHours) * 60;
      const roundedMinutes = Math.round(decimalMinutes);
      
      if (wholeRemainingHours === 0 && roundedMinutes === 0) {
        return `${days} day${days > 1 ? 's' : ''}`;
      } else if (wholeRemainingHours === 0) {
        return `${days} day${days > 1 ? 's' : ''} and ${roundedMinutes} minutes`;
      } else if (roundedMinutes === 0) {
        return `${days} day${days > 1 ? 's' : ''} and ${wholeRemainingHours} hour${wholeRemainingHours > 1 ? 's' : ''}`;
      } else {
        return `${days} day${days > 1 ? 's' : ''}, ${wholeRemainingHours} hour${wholeRemainingHours > 1 ? 's' : ''} and ${roundedMinutes} minutes`;
      }
    }
  }

  async getTimeTracking(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: { 
        id: jobId, 
        status: 1, 
        deleted_at: null 
      },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Check if user is job owner or helper
    const isJobOwner = job.user_id === userId;
    const isHelper = job.accepted_offers.some(
      offer => offer.counter_offer.helper_id === userId
    );

    if (!isJobOwner && !isHelper) {
      throw new ForbiddenException('Only job participants can view time tracking');
    }

    // Calculate current time if job is ongoing
    let currentHours = null;
    if (job.job_status === 'ongoing' && job.actual_start_time) {
      currentHours = this.calculateHours(job.actual_start_time, new Date());
    }

    return {
      job_id: job.id,
      job_type: job.job_type,
      job_status: job.job_status,
      estimated_time: job.estimated_time,
      estimated_hours: job.estimated_hours,
      hourly_rate: job.hourly_rate,
      original_price: job.price,
      final_price: job.final_price,
      start_time: job.start_time,
      end_time: job.end_time,
      actual_start_time: job.actual_start_time,
      actual_end_time: job.actual_end_time,
      actual_hours: job.actual_hours,
      current_hours: currentHours,
      is_tracking: job.job_status === 'ongoing' && job.actual_start_time,
      time_difference: job.actual_hours && job.estimated_hours 
        ? parseFloat(job.actual_hours.toString()) - parseFloat(job.estimated_hours.toString())
        : null,
      price_difference: job.final_price && job.price 
        ? parseFloat(job.final_price.toString()) - parseFloat(job.price.toString())
        : null,
    };
  }

  // Extra Time Request System
  async requestExtraTime(jobId: string, helperId: string, requestDto: any): Promise<any> {
    // Find the job and verify helper is assigned
    const job = await this.prisma.job.findFirst({
      where: { 
        id: jobId, 
        status: 1, 
        deleted_at: null,
        job_status: 'ongoing'
      },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found or not in ongoing status');
    }

    // Check if helper is assigned to this job
    const isHelperAssigned = job.accepted_offers.some(
      offer => offer.counter_offer.helper_id === helperId
    );

    if (!isHelperAssigned) {
      throw new ForbiddenException('Only assigned helpers can request extra time');
    }

    // Check if job is hourly
    if (job.payment_type !== 'HOURLY') {
      throw new BadRequestException('Extra time can only be requested for hourly jobs');
    }

    // Check if there's already a pending request
    if (job.extra_time_requested && job.extra_time_approved === null) {
      throw new BadRequestException('There is already a pending extra time request');
    }

    // Calculate estimated extra cost
    const extraCost = job.hourly_rate ? 
      parseFloat(job.hourly_rate.toString()) * requestDto.extra_hours : 0;

    // Update job with extra time request
    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        extra_time_requested: requestDto.extra_hours,
        extra_time_approved: null, // Pending approval
        extra_time_requested_at: new Date(),
        extra_time_approved_at: null,
      },
    });

    // TODO: Send notification to client about extra time request

    return {
      success: true,
      message: 'Extra time request submitted successfully',
      job_id: jobId,
      extra_hours_requested: requestDto.extra_hours,
      estimated_extra_cost: extraCost,
      reason: requestDto.reason,
      status: 'pending_approval'
    };
  }

  async approveExtraTime(jobId: string, clientId: string, approvalDto: any): Promise<any> {
    // Find the job and verify client owns it
    const job = await this.prisma.job.findFirst({
      where: { 
        id: jobId, 
        user_id: clientId,
        status: 1, 
        deleted_at: null,
        job_status: 'ongoing'
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found or you do not have permission to approve');
    }

    // Check if there's a pending request
    if (!job.extra_time_requested || job.extra_time_approved !== null) {
      throw new BadRequestException('No pending extra time request found');
    }

    let updateData: any = {
      extra_time_approved: approvalDto.approved,
      extra_time_approved_at: new Date(),
    };

    // If approved, calculate total approved hours
    if (approvalDto.approved) {
      const originalHours = job.estimated_hours ? parseFloat(job.estimated_hours.toString()) : 0;
      const extraHours = job.extra_time_requested ? parseFloat(job.extra_time_requested.toString()) : 0;
      updateData.total_approved_hours = originalHours + extraHours;
    }

    // Update job with approval decision
    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });

    // TODO: Send notification to helper about approval decision

    const totalApprovedHours = updateData.total_approved_hours ? parseFloat(updateData.total_approved_hours.toString()) : 0;

    return {
      success: true,
      message: approvalDto.approved ? 
        'Extra time request approved' : 
        'Extra time request rejected',
      job_id: jobId,
      approved: approvalDto.approved,
      extra_hours: approvalDto.approved ? job.extra_time_requested : 0,
      total_approved_hours: updateData.total_approved_hours,
      total_approved_hours_formatted: totalApprovedHours > 0 ? this.formatEstimatedTime(totalApprovedHours) : null,
      message_to_helper: approvalDto.message
    };
  }

  async getExtraTimeStatus(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.job.findFirst({
      where: { 
        id: jobId, 
        status: 1, 
        deleted_at: null 
      },
      include: {
        accepted_offers: {
          include: {
            counter_offer: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Check if user is job owner or assigned helper
    const isJobOwner = job.user_id === userId;
    const isHelper = job.accepted_offers.some(
      offer => offer.counter_offer.helper_id === userId
    );

    if (!isJobOwner && !isHelper) {
      throw new ForbiddenException('Only job participants can view extra time status');
    }

    const estimatedHours = job.estimated_hours ? parseFloat(job.estimated_hours.toString()) : 0;
    const extraHours = job.extra_time_requested ? parseFloat(job.extra_time_requested.toString()) : 0;
    const hourlyRate = job.hourly_rate ? parseFloat(job.hourly_rate.toString()) : 0;
    const extraCost = extraHours * hourlyRate;
    const totalApprovedHours = job.total_approved_hours ? parseFloat(job.total_approved_hours.toString()) : 0;

    return {
      job_id: job.id,
      title: job.title,
      job_status: job.job_status,
      payment_type: job.payment_type,
      estimated_hours: estimatedHours,
      hourly_rate: hourlyRate,
      original_price: job.price,
      extra_time_requested: job.extra_time_requested,
      extra_time_approved: job.extra_time_approved,
      total_approved_hours: totalApprovedHours,
      total_approved_hours_formatted: totalApprovedHours > 0 ? this.formatEstimatedTime(totalApprovedHours) : null,
      extra_time_requested_at: job.extra_time_requested_at,
      extra_time_approved_at: job.extra_time_approved_at,
      estimated_extra_cost: extraCost,
      can_request_extra_time: isHelper && job.job_status === 'ongoing' && 
        job.payment_type === 'HOURLY' && job.extra_time_approved === null,
      can_approve_extra_time: isJobOwner && job.job_status === 'ongoing' && 
        job.extra_time_requested && job.extra_time_approved === null,
    };
  }

}
