import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { v4 as uuidv4 } from 'uuid';

@ApiBearerAuth()
@ApiTags('Jobs')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @ApiOperation({ summary: 'Create a new job posting with optional photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        date_and_time: { type: 'string', format: 'date-time' },
        price: { type: 'number' },
        payment_type: { type: 'string' },
        job_type: { type: 'string' },
        location: { type: 'string' },
        estimated_time: { type: 'string' },
        description: { type: 'string' },
        requirements: { type: 'string' },
        notes: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, 
      fileFilter: (req, file, cb) => cb(null, true),
    }),
  )
  async create(
    @Body() createJobDto: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<JobResponseDto> {
    const userId = (req as any).user.id;
    
    // Parse JSON strings for requirements and notes
    let requirements = [];
    let notes = [];
    
    if (createJobDto.requirements) {
      try {
        requirements = JSON.parse(createJobDto.requirements);
      } catch (e) {
        requirements = [];
      }
    }
    
    if (createJobDto.notes) {
      try {
        notes = JSON.parse(createJobDto.notes);
      } catch (e) {
        notes = [];
      }
    }
    
    // Handle file upload if provided
    let photoPath = null;
    if (file) {
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
      await SojebStorage.put(uniqueFileName, file.buffer);
      photoPath = uniqueFileName;
    }
    
    // Create the job data object
    const jobData: CreateJobDto = {
      title: createJobDto.title,
      category: createJobDto.category,
      date_and_time: createJobDto.date_and_time,
      price: parseFloat(createJobDto.price),
      payment_type: createJobDto.payment_type,
      job_type: createJobDto.job_type,
      location: createJobDto.location,
      estimated_time: createJobDto.estimated_time,
      description: createJobDto.description,
      requirements: requirements,
      notes: notes,
    };
    
    return this.jobService.create(jobData, userId, photoPath);
  }

  @ApiOperation({ summary: 'Get all jobs with pagination and filters' })
  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('jobType') jobType?: string,
  ) {
    return this.jobService.findAll(
      parseInt(page),
      parseInt(limit),
      category,
      location,
      jobType,
    );
  }

  @ApiOperation({ summary: 'Get jobs posted by the current user' })
  @Get('my-jobs')
  async findMyJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return this.jobService.findByUser(userId, parseInt(page), parseInt(limit));
  }

  @ApiOperation({ summary: 'Get a specific job by ID' })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<JobResponseDto> {
    return this.jobService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a job posting' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Req() req: Request,
  ): Promise<JobResponseDto> {
    const userId = (req as any).user.id;
    return this.jobService.update(id, updateJobDto, userId);
  }

  @ApiOperation({ summary: 'Delete a job posting' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = (req as any).user.id;
    await this.jobService.remove(id, userId);
    return { message: 'Job deleted successfully' };
  }

  @ApiOperation({ summary: 'Upload photo for a job' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id') jobId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ message: string; photo: any }> {
    const userId = (req as any).user.id;
    
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
    
    // Upload file to storage
    await SojebStorage.put(uniqueFileName, file.buffer);
    
    const photoData = {
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      file: uniqueFileName,
      file_alt: file.originalname,
    };

    await this.jobService.addPhoto(jobId, photoData, userId);
    
    return {
      message: 'Photo uploaded successfully',
      photo: {
        ...photoData,
        url: SojebStorage.url(uniqueFileName),
      },
    };
  }

  @ApiOperation({ summary: 'Remove a photo from a job' })
  @Delete(':id/photos')
  async removePhoto(
    @Param('id') jobId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = (req as any).user.id;
    await this.jobService.removePhoto(jobId, userId);
    return { message: 'Photo removed successfully' };
  }
}
