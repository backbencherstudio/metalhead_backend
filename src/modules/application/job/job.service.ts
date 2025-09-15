import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';

@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) { }

  async create(createJobDto: CreateJobDto, userId: string, photoPath?: string): Promise<JobResponseDto> {
    const { requirements, notes, ...jobData } = createJobDto;

    const job = await this.prisma.job.create({
      data: {
        ...jobData,
        user_id: userId,
        photos: photoPath,
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



  async completeJob(id: string, userId: string): Promise<void> {
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

    if (!isJobOwner && !isHelper) {
      throw new ForbiddenException('Only job participants can mark job as completed');
    }

    // Check if job has an accepted offer
    if (!job.accepted_offers || job.accepted_offers.length === 0) {
      throw new BadRequestException('Job must have an accepted offer to be completed');
    }

    // Check if job is in confirmed status
    if (job.job_status !== 'confirmed') {
      throw new BadRequestException('Job must be confirmed before it can be completed');
    }

    await this.prisma.job.update({
      where: { id },
      data: {
        job_status: 'completed',
      },
    });
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
      estimated_time: job.estimated_time,
      description: job.description,
      requirements: job.requirements || [],
      notes: job.notes || [],
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
}
