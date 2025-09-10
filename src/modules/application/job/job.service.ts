import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';

@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(
    page: number = 1,
    limit: number = 10,
    category?: string,
    location?: string,
    jobType?: string,
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

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
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

  async update(id: string, updateJobDto: UpdateJobDto, userId: string): Promise<JobResponseDto> {
    const existingJob = await this.prisma.job.findFirst({
      where: {
        id,
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!existingJob) {
      throw new NotFoundException('Job not found or you do not have permission to update it');
    }

    const { requirements, notes, ...jobData } = updateJobDto;

    const job = await this.prisma.job.update({
      where: { id },
      data: {
        ...jobData,
        requirements: requirements
          ? {
              deleteMany: {},
              create: requirements.map((req) => ({
                title: req.title,
                description: req.description,
              })),
            }
          : undefined,
        notes: notes
          ? {
              deleteMany: {},
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
    };
  }
}
