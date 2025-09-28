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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { UpdateHelperPreferencesDto } from './dto/update-helper-preferences.dto';
import { CategoriesListResponseDto, CategoryResponseDto } from './dto/category-response.dto';
import { JobCategory, JOB_CATEGORY_LABELS, JOB_CATEGORY_DESCRIPTIONS } from './enums/job-category.enum';
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
    const userId = (req as any).user.userId || (req as any).user.id;
    console.log('JWT User Object:', (req as any).user);
    console.log('Extracted User ID:', userId);
    
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
      urgent_note: createJobDto.urgent_note,
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
    @Query('priceRange') priceRange?: string,  // price range will come as a string (e.g., "100,500")
    @Query('sortBy') sortBy?: string, // sorting options
    @Query('search') search?: string, // search in title and description
  ) {
    // Validate category if provided
    if (category && !Object.values(JobCategory).includes(category as JobCategory)) {
      throw new BadRequestException(`Invalid category: ${category}. Valid categories are: ${Object.values(JobCategory).join(', ')}`);
    }

    let parsedPriceRange = null;
    if (priceRange) {
      const [min, max] = priceRange.split(',').map((str) => parseFloat(str));
      parsedPriceRange = { min, max };
    }

    return this.jobService.findAll(
      parseInt(page),
      parseInt(limit),
      category,
      location,
      jobType,
      parsedPriceRange,
      sortBy,
      search,
    );
  }


  @ApiOperation({ summary: 'Get jobs posted by the current user' })
  @Get('my-jobs')
  async findMyJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.findByUser(userId, parseInt(page), parseInt(limit));
  }

  @ApiOperation({ summary: 'Get all available job categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully', type: CategoriesListResponseDto })
  @Get('categories')
  async getCategories(): Promise<CategoriesListResponseDto> {
    const categories: CategoryResponseDto[] = Object.values(JobCategory).map(category => ({
      key: category,
      label: JOB_CATEGORY_LABELS[category],
      description: JOB_CATEGORY_DESCRIPTIONS[category],
    }));

    return {
      categories,
      total: categories.length,
    };
  }

  @ApiOperation({ summary: 'Get specific category details' })
  @ApiResponse({ status: 200, description: 'Category details retrieved successfully', type: CategoryResponseDto })
  @Get('categories/:category')
  async getCategoryDetails(@Param('category') category: string): Promise<CategoryResponseDto> {
    if (!Object.values(JobCategory).includes(category as JobCategory)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }

    const categoryKey = category as JobCategory;
    return {
      key: categoryKey,
      label: JOB_CATEGORY_LABELS[categoryKey],
      description: JOB_CATEGORY_DESCRIPTIONS[categoryKey],
    };
  }

  @ApiOperation({ summary: 'Get jobs by specific category' })
  @ApiResponse({ status: 200, description: 'Jobs filtered by category', type: [JobResponseDto] })
  @Get('by-category/:category')
  async getJobsByCategory(
    @Param('category') category: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('location') location?: string,
    @Query('jobType') jobType?: string,
    @Query('priceRange') priceRange?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    // Validate category
    if (!Object.values(JobCategory).includes(category as JobCategory)) {
      throw new BadRequestException(`Invalid category: ${category}. Valid categories are: ${Object.values(JobCategory).join(', ')}`);
    }

    let parsedPriceRange = null;
    if (priceRange) {
      const [min, max] = priceRange.split(',').map((str) => parseFloat(str));
      parsedPriceRange = { min, max };
    }

    const result = await this.jobService.findAll(
      parseInt(page),
      parseInt(limit),
      category,
      location,
      jobType,
      parsedPriceRange,
      sortBy,
    );

    return {
      ...result,
      category: {
        key: category,
        label: JOB_CATEGORY_LABELS[category as JobCategory],
        description: JOB_CATEGORY_DESCRIPTIONS[category as JobCategory],
      },
    };
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
        file: { type: 'string', format: 'binary' },
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
    const userId = (req as any).user.userId || (req as any).user.id;

    let requirements = [];
    let notes = [];
    if (updateJobDto?.requirements) {
      try { requirements = JSON.parse(updateJobDto.requirements); } catch {}
    }
    if (updateJobDto?.notes) {
      try { notes = JSON.parse(updateJobDto.notes); } catch {}
    }

    let photoPath: string | undefined;
    const fileCandidate =
      files?.file?.[0] || files?.File?.[0] || files?.image?.[0] || files?.photo?.[0];
    if (fileCandidate) {
      const fileExtension = fileCandidate.originalname.split('.').pop();
      const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
      await SojebStorage.put(uniqueFileName, fileCandidate.buffer);
      photoPath = uniqueFileName;
    }

    const dto: UpdateJobDto = {
      title: updateJobDto?.title,
      category: updateJobDto?.category,
      date_and_time: updateJobDto?.date_and_time,
      price: updateJobDto?.price ? parseFloat(updateJobDto.price) : undefined,
      payment_type: updateJobDto?.payment_type,
      job_type: updateJobDto?.job_type,
      location: updateJobDto?.location,
      estimated_time: updateJobDto?.estimated_time,
      description: updateJobDto?.description,
      requirements: requirements.length ? requirements : undefined,
      notes: notes.length ? notes : undefined,
      urgent_note: updateJobDto?.urgent_note,
    } as any;

    return this.jobService.update(id, dto, userId, photoPath);
  }

 

  @ApiOperation({ summary: 'Mark job as started (Helper only)' })
  @Patch(':id/start')
  async startJob(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    await this.jobService.startJob(id, userId);
    return { message: 'Job marked as started successfully' };
  }

  @ApiOperation({ summary: 'Mark job as completed (Helper only)' })
  @Patch(':id/complete')
  async completeJob(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    await this.jobService.completeJob(id, userId);
    return { message: 'Job marked as completed successfully' };
  }

  @ApiOperation({ summary: 'Mark job as finished and release payment (User only)' })
  @Patch(':id/finish')
  async finishJob(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    await this.jobService.finishJob(id, userId);
    return { message: 'Job marked as finished and payment released successfully' };
  }

  @ApiOperation({ summary: 'Auto-complete job after 24 hours (System only)' })
  @Patch(':id/auto-complete')
  async autoCompleteJob(@Param('id') id: string): Promise<{ message: string }> {
    await this.jobService.autoCompleteJob(id);
    return { message: 'Job auto-completed and payment released successfully' };
  }

  @ApiOperation({ summary: 'Get job status timeline' })
  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    return this.jobService.getTimeline(id);
  }

  @ApiOperation({ summary: 'Delete a job posting' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    await this.jobService.remove(id, userId);
    return { message: 'Job deleted successfully' };
  }

  @ApiOperation({ summary: 'Update helper notification preferences' })
  @Patch('helper/preferences')
  async updateHelperPreferences(
    @Body() dto: UpdateHelperPreferencesDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      
      console.log('JWT User Object:', (req as any).user);
      console.log('Extracted User ID:', userId);
      
      if (!userId) {
        throw new Error('User ID not found in request');
      }

      await this.jobService.updateHelperPreferences(userId, dto);
      return { message: 'Helper preferences updated successfully' };
    } catch (error) {
      throw new Error(`Failed to update helper preferences: ${error.message}`);
    }
  }

  @ApiOperation({ summary: 'Test geocoding service with an address' })
  @Get('test-geocoding/:address')
  async testGeocoding(@Param('address') address: string): Promise<{ success: boolean; coordinates?: { lat: number; lng: number }; message: string }> {
    try {
      const coordinates = await this.jobService.testGeocoding(address);
      if (coordinates) {
        return {
          success: true,
          coordinates,
          message: `Successfully geocoded "${address}" to (${coordinates.lat}, ${coordinates.lng})`
        };
      } else {
        return {
          success: false,
          message: `Failed to geocode address: "${address}"`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Geocoding error: ${error.message}`
      };
    }
  }


  @ApiOperation({ summary: 'Debug: Get current user info' })
  @Get('debug/user-info')
  async getUserInfo(@Req() req: Request): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return {
      jwtUser: (req as any).user,
      extractedUserId: userId,
      timestamp: new Date().toISOString(),
    };
  }

}
