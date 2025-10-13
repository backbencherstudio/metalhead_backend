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
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
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
        photoes: { type: 'string', format: 'binary' },
      },
    },
  })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photoes', maxCount: 10 },
      { name: 'file', maxCount: 1 },
      { name: 'photos', maxCount: 10 }
    ], {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, 
      fileFilter: (req, file, cb) => cb(null, true),
    }),
  )
  async create(
    @Body() createJobDto: any,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
    @Req() req: Request,
  ): Promise<JobResponseDto> {
    const userId = (req as any).user.userId;
    
    // Verify user exists
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    
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
    let photoPaths = [];
    
    // Handle multiple file field names and ensure we get all files
    const allFiles = [];
    
    // Check for photoes field (primary)
    if (files?.photoes && Array.isArray(files.photoes)) {
      allFiles.push(...files.photoes);
    }
    
    // Check for photos field (alternative)
    if (files?.photos && Array.isArray(files.photos)) {
      allFiles.push(...files.photos);
    }
    
    // Check for file field (fallback)
    if (files?.file && Array.isArray(files.file)) {
      allFiles.push(...files.file);
    }
    
    for (const file of allFiles) {
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
      await SojebStorage.put(uniqueFileName, file.buffer);
      photoPaths.push(uniqueFileName);
    }
    // Store photos as JSON string in database
    const photoPath = photoPaths.length > 0 ? JSON.stringify(photoPaths) : null;
    
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
    const userId = (req as any).user.userId;
    return this.jobService.findByUser(userId, parseInt(page), parseInt(limit));
  }

  @ApiOperation({ summary: 'Get a specific job by ID' })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<JobResponseDto> {
    return this.jobService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a job posting (supports image replace)' })
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
        photoes: { type: 'string', format: 'binary' },
      },
    },
  })
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'File', maxCount: 1 },
        { name: 'image', maxCount: 1 },
        { name: 'photo', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => cb(null, true),
      },
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() updateJobDto: any,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
    @Req() req: Request,
  ): Promise<JobResponseDto> {
    const userId = (req as any).user.userId;

    let requirements = [];
    let notes = [];
    if (updateJobDto.requirements) {
      try { requirements = JSON.parse(updateJobDto.requirements); } catch {}
    }
    if (updateJobDto.notes) {
      try { notes = JSON.parse(updateJobDto.notes); } catch {}
    }

    let photoPath: string | undefined;
    const uploadedFiles = files?.photoes || files?.file || files?.File || files?.image || files?.photo || [];
    
    if (uploadedFiles.length > 0) {
      const photoPaths = [];
      for (const file of uploadedFiles) {
        const fileExtension = file.originalname.split('.').pop();
        const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
        await SojebStorage.put(uniqueFileName, file.buffer);
        photoPaths.push(uniqueFileName);
      }
      photoPath = JSON.stringify(photoPaths);
    }

    const dto: UpdateJobDto = {
      title: updateJobDto.title,
      category: updateJobDto.category,
      date_and_time: updateJobDto.date_and_time,
      price: updateJobDto.price ? parseFloat(updateJobDto.price) : undefined,
      payment_type: updateJobDto.payment_type,
      job_type: updateJobDto.job_type,
      location: updateJobDto.location,
      estimated_time: updateJobDto.estimated_time,
      description: updateJobDto.description,
      requirements: requirements.length ? requirements : undefined,
      notes: notes.length ? notes : undefined,
    } as any;

    return this.jobService.update(id, dto, userId, photoPath);
  }

 

  @ApiOperation({ summary: 'Delete a job posting' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = (req as any).user.userId;
    await this.jobService.remove(id, userId);
    return { message: 'Job deleted successfully' };
  }

}
