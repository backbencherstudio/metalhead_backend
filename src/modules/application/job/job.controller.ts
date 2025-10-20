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
  Put,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { JobService } from './job.service';
import { JobNotificationService } from './job-notification.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { JobCreateResponseDto } from './dto/job-create-response.dto';
import { JobListResponseDto } from './dto/job-list-response.dto';
import { JobSingleResponseDto } from './dto/job-single-response.dto';
import { EnumMapper } from './utils/enum-mapper.util';
import { RequestExtraTimeDto } from './dto/request-extra-time.dto';
import { ApproveExtraTimeDto } from './dto/approve-extra-time.dto';
import { UpdateHelperPreferencesDto } from './dto/update-helper-preferences.dto';
import { AddExtraTimeDto } from './dto/add-extra-time.dto';
import { CategoriesListResponseDto, CategoryResponseDto } from './dto/category-response.dto';
import { LatestJobResponseDto } from './dto/latest-job-response.dto';
import { JOB_CATEGORY_LABELS, JOB_CATEGORY_DESCRIPTIONS } from './enums/job-category.enum';
import { JobCategory } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { v4 as uuidv4 } from 'uuid';

@ApiBearerAuth()
@ApiTags('Jobs')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobNotificationService: JobNotificationService
  ) {}

  @ApiOperation({ summary: 'Create a new job posting with optional photo' })
  @ApiResponse({ status: 201, description: 'Job created successfully', type: JobCreateResponseDto })
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
        estimated_time: { type: 'number' },
        description: { type: 'string' },
        requirements: { type: 'string' },
        notes: { type: 'string' },
        files: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'Multiple image files (up to 10 files, 10MB each)'
        },
        photoes: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'Alternative field name for multiple image files'
        },
        photos: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'Alternative field name for multiple image files'
        },
      },
    },
  })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'files', maxCount: 10 },
      { name: 'photoes', maxCount: 10 },
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
  ): Promise<JobCreateResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    
    // Parse JSON strings for requirements and notes
    let requirements = [];
    let notes = [];
    
    if (createJobDto.requirements) {
      try {
        if (typeof createJobDto.requirements === 'string') {
          console.log('DEBUG - Parsing requirements string:', createJobDto.requirements);
          
          // Fix malformed JSON by adding missing commas
          let cleanedJson = createJobDto.requirements
            .replace(/}\s*{/g, '},{') // Add commas between objects
            .replace(/}\s*\]/g, '}]') // Fix last object
            .replace(/\[\s*{/g, '[{') // Fix first object
            .replace(/\n/g, '') // Remove newlines
            .replace(/\r/g, ''); // Remove carriage returns
          
          
        } else if (Array.isArray(createJobDto.requirements)) {
          requirements = createJobDto.requirements;
        }
      } catch (e) {
        console.error('DEBUG - Error parsing requirements:', e);;
        requirements = [];
      }
    }
   
    if (createJobDto.notes) {
      try {
        if (typeof createJobDto.notes === 'string') {
          // Fix malformed JSON by adding missing commas
          let cleanedJson = createJobDto.notes
            .replace(/}\s*{/g, '},{') // Add commas between objects
            .replace(/}\s*\]/g, '}]') // Fix last object
            .replace(/\[\s*{/g, '[{') // Fix first object
            .replace(/\n/g, '') // Remove newlines
            .replace(/\r/g, ''); // Remove carriage returns
          
          notes = JSON.parse(cleanedJson);
        } else if (Array.isArray(createJobDto.notes)) {
          notes = createJobDto.notes;
        }
      } catch (e) {
        console.error('DEBUG - Error parsing notes:', e);
        notes = [];
      }
    }
    
    // Handle file upload if provided
    let photoPaths: string[] = [];
    
    // Handle multiple files from various field names
    const fileFields = ['files', 'photoes', 'photos'];
    
    for (const fieldName of fileFields) {
      if (files?.[fieldName] && files[fieldName].length > 0) {
        console.log(`Processing ${files[fieldName].length} files from field: ${fieldName}`);
        for (const file of files[fieldName]) {
          const fileExtension = file.originalname.split('.').pop();
          const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
          await SojebStorage.put(uniqueFileName, file.buffer);
          photoPaths.push(uniqueFileName);
        }
      }
    }
    // Store photos as JSON string in database
    const photoPath = photoPaths.length > 0 ? JSON.stringify(photoPaths) : null;
    
    // Handle single files from other fields (fallback)
    const singleFile = files?.file?.[0] || files?.image?.[0] || files?.photo?.[0];
    if (singleFile) {
      const fileExtension = singleFile.originalname.split('.').pop();
      const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
      await SojebStorage.put(uniqueFileName, singleFile.buffer);
      photoPaths.push(uniqueFileName);
    }
  
    let latitude: number | undefined;
    let longitude: number | undefined;
    
    // Only process coordinates if they are provided
    if (createJobDto.latitude !== undefined && createJobDto.longitude !== undefined) {
      // Validate coordinates - handle different input types from Flutter
      if (typeof createJobDto.latitude === 'string') {
        latitude = parseFloat(createJobDto.latitude);
      } else if (typeof createJobDto.latitude === 'number') {
        latitude = createJobDto.latitude;
      } else {
        latitude = parseFloat(createJobDto.latitude);
      }
      
      if (typeof createJobDto.longitude === 'string') {
        longitude = parseFloat(createJobDto.longitude);
      } else if (typeof createJobDto.longitude === 'number') {
        longitude = createJobDto.longitude;
      } else {
        longitude = parseFloat(createJobDto.longitude);
      }
      
      // Only validate if coordinates were provided
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new BadRequestException(`Latitude and longitude must be valid numbers. Received: lat="${createJobDto.latitude}" (type: ${typeof createJobDto.latitude}), lng="${createJobDto.longitude}" (type: ${typeof createJobDto.longitude})`);
      }
    }

    // Map all enums using the comprehensive mapping system
    const category = EnumMapper.mapCategory(createJobDto.category);
    const paymentType = EnumMapper.mapPaymentType(createJobDto.payment_type);
    const jobType = EnumMapper.mapJobType(createJobDto.job_type);


    // Create the job data object
    const jobData: CreateJobDto = {
      title: createJobDto.title,
      category: category as any, // Use mapped category
      price: createJobDto.price,
      payment_type: paymentType as any, // Use mapped payment type
      job_type: jobType as any, // Use mapped job type
      location: createJobDto.location,
      latitude: latitude, // Will be undefined if not provided, allowing geocoding
      longitude: longitude, // Will be undefined if not provided, allowing geocoding
      start_time: createJobDto.start_time,
      end_time: createJobDto.end_time,
      description: createJobDto.description,
      requirements: requirements,
      notes: notes,
      urgent_note: createJobDto.urgent_note,
    };
    
    
    
    return this.jobService.create(jobData, userId, photoPaths);
  }

  @ApiOperation({ summary: 'Get all jobs with comprehensive filters (no pagination - Flutter handles pagination)' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully', type: JobListResponseDto })
  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('jobType') jobType?: string, // URGENT or ANYTIME
    @Query('paymentType') paymentType?: string, // HOURLY or FIXED
    @Query('jobStatus') jobStatus?: string, // posted, counter_offer, confirmed, ongoing, completed, paid
    @Query('priceRange') priceRange?: string,  // price range will come as a string (e.g., "100,500")
    @Query('dateRange') dateRange?: string, // date range as "startDate,endDate" (e.g., "2024-01-01,2024-12-31")
    @Query('sortBy') sortBy?: string, // sorting options: price_asc, price_desc, location, title, urgency, created_at
    @Query('search') search?: string, // search in title and description
    @Query('urgency') urgency?: string, // filter by urgency: 'urgent' or 'normal'
  ): Promise<JobListResponseDto> {
    // Validate category if provided
    if (category && !Object.values(JobCategory).includes(category as JobCategory)) {
      throw new BadRequestException(`Invalid category: ${category}. Valid categories are: ${Object.values(JobCategory).join(', ')}`);
    }

    let parsedPriceRange = null;
    if (priceRange) {
      const [min, max] = priceRange.split(',').map((str) => parseFloat(str));
      parsedPriceRange = { min, max };
    }

    let parsedDateRange = null;
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',');
      parsedDateRange = { 
        start: new Date(startDate), 
        end: new Date(endDate) 
      };
    }

    const result = await this.jobService.findAll(
      category as JobCategory,
      location,
      jobType,
      paymentType,
      jobStatus,
      parsedPriceRange,
      parsedDateRange,
      sortBy,
      search,
      urgency,
    );

    return {
      success: true,
      message: `Found ${result.jobs.length} jobs`,
      data: {
        jobs: result.jobs,
        total: result.total,
      },
    };
  }


  @ApiOperation({ summary: 'Get jobs posted by the current user (no pagination - Flutter handles pagination)' })
  @ApiResponse({ status: 200, description: 'User jobs retrieved successfully', type: JobListResponseDto })
  @Get('my-jobs')
  async findMyJobs(
    @Req() req: Request,
  ): Promise<JobListResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    const result = await this.jobService.findByUser(userId);
    
    return {
      success: true,
      message: `Found ${result.jobs.length} of your jobs`,
      data: {
        jobs: result.jobs,
        total: result.total,
      },
    };
  }

  @ApiOperation({ summary: 'Get latest upcoming appointment for user' })
  @ApiResponse({ status: 200, description: 'Latest appointment retrieved successfully', type: LatestJobResponseDto })
  @Get('upcoming')
  async getLatestAppointment(@Req() req: Request) {
    const userId = req.user.userId
    const userType=(req as any).user.type;
    const latestJob = await this.jobService.upcomingEvents(userId,userType);
    
    return {
      success: true,
      latestJob: latestJob,
    };
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

  @ApiOperation({ summary: 'Get job counts by category' })
  @ApiResponse({ status: 200, description: 'Job counts by category retrieved successfully' })
  @Get('categories/with-counts')
  async getJobCountsByCategory() {
    try {
      const counts = await this.jobService.getJobCountsByCategory();
      return {
        success: true,
        message: 'Job counts by category retrieved successfully',
        data: counts
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
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

  @ApiOperation({ summary: 'Get jobs by specific category with comprehensive filters (no pagination - Flutter handles pagination)' })
  @ApiResponse({ status: 200, description: 'Jobs filtered by category', type: [JobResponseDto] })
  @Get('by-category/:category')
  async getJobsByCategory(
    @Param('category') givencategory: string,
    @Query('location') location?: string,
    @Query('jobType') jobType?: string, // URGENT or ANYTIME
    @Query('paymentType') paymentType?: string, // HOURLY or FIXED
    @Query('jobStatus') jobStatus?: string, // posted, counter_offer, confirmed, ongoing, completed, paid
    @Query('priceRange') priceRange?: string,
    @Query('dateRange') dateRange?: string,
    @Query('sortBy') sortBy?: string,
    @Query('search') search?: string,
    @Query('urgency') urgency?: string,
  ) {
    // Validate category
    const category=givencategory.toUpperCase();
    if (!Object.values(JobCategory).includes(category as JobCategory)) {
      throw new BadRequestException(`Invalid category: ${category}. Valid categories are: ${Object.values(JobCategory).join(', ')}`);
    }

    let parsedPriceRange = null;
    if (priceRange) {
      const [min, max] = priceRange.split(',').map((str) => parseFloat(str));
      parsedPriceRange = { min, max };
    }

    let parsedDateRange = null;
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',');
      parsedDateRange = { 
        start: new Date(startDate), 
        end: new Date(endDate) 
      };
    }

    // Cast category to the correct Prisma enum type (assuming it's imported as PrismaJobCategory)
    const result = await this.jobService.findAll(
      category as any, // Temporary workaround: should match the target enum type in the service
      location,
      jobType,
      paymentType,
      jobStatus,
      parsedPriceRange,
      parsedDateRange,
      sortBy,
      search,
      urgency,
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
  @ApiResponse({ status: 200, description: 'Job retrieved successfully', type: JobSingleResponseDto })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<JobSingleResponseDto> {
    const job = await this.jobService.findOne(id);
    
    return {
      success: true,
      message: 'Job retrieved successfully',
      data: job,
    };
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
        estimated_time: { type: 'number' },
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
      title: updateJobDto?.title,
      category: updateJobDto?.category,
      date_and_time: updateJobDto?.date_and_time,
      price: updateJobDto?.price ? parseFloat(updateJobDto.price) : undefined,
      payment_type: updateJobDto?.payment_type,
      job_type: updateJobDto?.job_type,
      location: updateJobDto?.location,
      description: updateJobDto?.description,
      requirements: requirements.length ? requirements : undefined,
      notes: notes.length ? notes : undefined,
      urgent_note: updateJobDto?.urgent_note,
    } as any;

    return this.jobService.update(id, dto, userId, photoPath);
  }

 

  @ApiOperation({ summary: 'Mark job as started (Helper only)' })
  @Patch(':id/start')
  async startJob(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const helperId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.startJob(id, helperId);
  }

  @ApiOperation({ summary: 'Mark job as completed (Helper only) - Returns time tracking data for hourly jobs' })
  @Patch(':id/complete')
  async completeJob(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const helperId = (req as any).user.userId || (req as any).user.id;
    return await this.jobService.completeJob(id, helperId);
  }

  @ApiOperation({ summary: 'Mark job as finished and release payment (User only)' })
  @Patch(':id/finish')
  async finishJob(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.finishJob(id, userId);
  }

  @ApiOperation({ summary: 'Auto-complete job after 24 hours (System only)' })
  @Patch(':id/auto-complete')
  async autoCompleteJob(@Param('id') id: string): Promise<{ message: string }> {
    // This would be called by a system process, not a user
    // For now, return a placeholder message
    return { message: 'Job auto-completed and payment released successfully' };
  }

  @ApiOperation({ summary: 'Get time tracking information for hourly jobs' })
  @Get(':id/time-tracking')
  async getTimeTracking(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.getTimeTracking(id, userId);
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
      
      if (!userId) {
        throw new Error('User ID not found in request');
      }

      await this.jobService.updateHelperPreferences(userId, dto);
      return { message: 'Helper preferences updated successfully' };
    } catch (error) {
      throw new Error(`Failed to update helper preferences: ${error.message}`);
    }
  }



  // ==================== FIREBASE NOTIFICATION ENDPOINTS ====================

  @ApiOperation({ summary: 'Add device token for push notifications' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        deviceToken: { type: 'string', description: 'Firebase device token' }
      },
      required: ['deviceToken']
    }
  })
  @Post('device-token')
  async addDeviceToken(@Body() body: { deviceToken: string }, @Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      await this.jobNotificationService.addDeviceToken(userId, body.deviceToken);
      
      return {
        success: true,
        message: 'Device token added successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Remove device token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        deviceToken: { type: 'string', description: 'Firebase device token to remove' }
      },
      required: ['deviceToken']
    }
  })
  @Delete('device-token')
  async removeDeviceToken(@Body() body: { deviceToken: string }, @Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      await this.jobNotificationService.removeDeviceToken(userId, body.deviceToken);
      
      return {
        success: true,
        message: 'Device token removed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get user device tokens' })
  @Get('device-tokens')
  async getDeviceTokens(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const tokens = await this.jobNotificationService.getUserDeviceTokens(userId);
      
      return {
        success: true,
        data: {
          userId,
          deviceTokens: tokens,
          count: tokens.length
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

 
  @ApiOperation({ summary: 'Get past appointments for user' })
  @ApiResponse({ status: 200, description: 'Past appointments retrieved successfully' })
  @Get('past-appointments')
  async jobHistory(@Req() req: Request) {
    try {
      const userId = req.user.userId
      const userType=(req as any).user.type;
      const appointments = await this.jobService.jobHistory(userId,userType);
      return {
        success: true,
        message: 'Past appointments retrieved successfully',
        data: appointments
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }



  @ApiOperation({ summary: 'Get historical earnings graph data' })
  @ApiResponse({ status: 200, description: 'Historical earnings data retrieved successfully' })
  @Get('earnings/historical')
  async getHistoricalEarnings(
    @Req() req: Request,
    @Query('period') period: string = 'week',
    @Query('days') days: string = '7'
  ) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const userType = (req as any).user.type;
      const earningsData = await this.jobService.getHistoricalEarnings(userId, userType, period, parseInt(days));
      return {
        success: true,
        message: 'Historical earnings data retrieved successfully',
        data: earningsData
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get weekly earnings breakdown' })
  @ApiResponse({ status: 200, description: 'Weekly earnings breakdown retrieved successfully' })
  @Get('earnings/weekly')
  async getWeeklyEarnings(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const userType = (req as any).user.type;
      const weeklyData = await this.jobService.getWeeklyEarnings(userId, userType);
      return {
        success: true,
        message: 'Weekly earnings breakdown retrieved successfully',
        data: weeklyData
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }


  // Extra Time Request System Endpoints
  @Post(':id/request-extra-time')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Helper requests extra time for ongoing job' })
  @ApiResponse({ status: 200, description: 'Extra time request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data or job not eligible' })
  @ApiResponse({ status: 403, description: 'Forbidden - only assigned helpers can request' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async requestExtraTime(
    @Param('id') jobId: string,
    @Body() requestDto: RequestExtraTimeDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.jobService.requestExtraTime(jobId, userId, requestDto);
  }

  @Put(':id/approve-extra-time')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Client approves or rejects extra time request' })
  @ApiResponse({ status: 200, description: 'Extra time request approved/rejected successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - no pending request found' })
  @ApiResponse({ status: 403, description: 'Forbidden - only job owner can approve' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async approveExtraTime(
    @Param('id') jobId: string,
    @Body() approvalDto: ApproveExtraTimeDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.jobService.approveExtraTime(jobId, userId, approvalDto);
  }

  @Get(':id/extra-time-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get extra time request status for a job' })
  @ApiResponse({ status: 200, description: 'Extra time status retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only job participants can view' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getExtraTimeStatus(
    @Param('id') jobId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.jobService.getExtraTimeStatus(jobId, userId);
  }

  // ===== JOB STATUS MANAGEMENT ENDPOINTS =====

  /**
   * Cancel a job
   */
  @ApiOperation({ summary: 'Cancel a job (User only)' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only job owner can cancel' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @Delete(':id/cancel')
  async cancelJob(
    @Param('id') jobId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.jobService.cancelJob(jobId, userId);
  }

  /**
   * Add extra time to an ongoing job
   */
  @ApiOperation({ summary: 'Add extra time to an ongoing job (User only)' })
  @ApiResponse({ status: 200, description: 'Extra time added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only job owner can add time' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @Post(':id/add-time')
  async addExtraTime(
    @Param('id') jobId: string,
    @Body() addExtraTimeDto: AddExtraTimeDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.jobService.addExtraTime(jobId, userId, addExtraTimeDto.extraMinutes);
  }

  /**
   * Get job status for timeline
   */
  @ApiOperation({ summary: 'Get job status for timeline display' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only job participants can view' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @Get(':id/status')
  async getJobStatus(
    @Param('id') jobId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.jobService.getJobStatus(jobId, userId);
  }

  


}
