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

    // record posted history
    await (this.prisma as any).jobStatusHistory?.create({
      data: {
        job_id: job.id,
        status: 'posted',
        occurred_at: job.created_at,
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
      await tx.job.update({
        where: { id },
        data: {
          job_status: 'completed',
        },
      });

      await (tx as any).jobStatusHistory?.create({
        data: {
          job_id: id,
          status: 'completed',
          occurred_at: new Date(),
        },
      });
    });
  }

  async finishJob(id: string, userId: string): Promise<void> {
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

    // Check if the user is the job owner (only job owner can finish and release payment)
    if (job.user_id !== userId) {
      throw new ForbiddenException('Only job owner can finish the job and release payment');
    }

    // Check if job has an accepted offer
    if (!job.accepted_offers || job.accepted_offers.length === 0) {
      throw new BadRequestException('Job must have an accepted offer to be finished');
    }

    // Check if job is in completed status
    if (job.job_status !== 'completed') {
      throw new BadRequestException('Job must be completed by helper before it can be finished');
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
          status: 'paid',
          occurred_at: new Date(),
        },
      });
    });

    // TODO: Add escrow payment release logic here
    // This will be implemented when escrow service is available
    console.log(`Payment should be released for job ${id} to helper ${job.accepted_offers[0].counter_offer.helper_id}`);
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
      await tx.job.update({ where: { id }, data: { job_status: 'ongoing' } });
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
}
