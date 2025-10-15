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
        estimated_time: { type: 'string' },
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
          
          console.log('DEBUG - Cleaned JSON:', cleanedJson);
          requirements = JSON.parse(cleanedJson);
          console.log('DEBUG - Parsed requirements:', requirements);
        } else if (Array.isArray(createJobDto.requirements)) {
          console.log('DEBUG - Using requirements array directly:', createJobDto.requirements);
          requirements = createJobDto.requirements;
        }
      } catch (e) {
        console.error('DEBUG - Error parsing requirements:', e);
        console.log('DEBUG - Requirements parse error, using empty array');
        requirements = [];
      }
    }
    
    console.log('DEBUG - Final requirements array:', requirements);
    console.log('DEBUG - Final requirements length:', requirements.length);
    
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
    
    // Handle single files from other fields (fallback)
    const singleFile = files?.file?.[0] || files?.image?.[0] || files?.photo?.[0];
    if (singleFile) {
      const fileExtension = singleFile.originalname.split('.').pop();
      const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
      await SojebStorage.put(uniqueFileName, singleFile.buffer);
      photoPaths.push(uniqueFileName);
    }
    
    console.log(`Total photos processed: ${photoPaths.length}`);
    
    // Job type validation is now handled by EnumMapper.mapJobType()

    // Debug: Log the received price value and type
    console.log('DEBUG - Received price:', createJobDto.price);
    console.log('DEBUG - Price type:', typeof createJobDto.price);
    console.log('DEBUG - Price isNaN:', isNaN(createJobDto.price));
    
    // Validate and convert price - handle different input types from Flutter
    let price: number;
    if (typeof createJobDto.price === 'string') {
      // Remove any currency symbols or commas
      const cleanPrice = createJobDto.price.replace(/[$,]/g, '');
      price = parseFloat(cleanPrice);
      console.log('DEBUG - Cleaned price string:', cleanPrice);
      console.log('DEBUG - Parsed price:', price);
    } else if (typeof createJobDto.price === 'number') {
      price = createJobDto.price;
      console.log('DEBUG - Using number directly:', price);
    } else {
      price = parseFloat(createJobDto.price);
      console.log('DEBUG - Fallback parseFloat result:', price);
    }
    
    console.log('DEBUG - Final price value:', price);
    console.log('DEBUG - Final price isNaN:', isNaN(price));
    console.log('DEBUG - Final price <= 0:', price <= 0);
    
    if (isNaN(price) || price <= 0) {
      throw new BadRequestException(`Price must be a valid positive number. Received: "${createJobDto.price}" (type: ${typeof createJobDto.price})`);
    }

    // Debug: Log the received coordinate values
    console.log('DEBUG - Received latitude:', createJobDto.latitude, 'type:', typeof createJobDto.latitude);
    console.log('DEBUG - Received longitude:', createJobDto.longitude, 'type:', typeof createJobDto.longitude);
    
    // Validate coordinates - handle different input types from Flutter
    let latitude: number;
    let longitude: number;
    
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
    
    console.log('DEBUG - Final latitude:', latitude, 'isNaN:', isNaN(latitude));
    console.log('DEBUG - Final longitude:', longitude, 'isNaN:', isNaN(longitude));
    
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException(`Latitude and longitude must be valid numbers. Received: lat="${createJobDto.latitude}" (type: ${typeof createJobDto.latitude}), lng="${createJobDto.longitude}" (type: ${typeof createJobDto.longitude})`);
    }

    // Map all enums using the comprehensive mapping system
    const category = EnumMapper.mapCategory(createJobDto.category);
    const paymentType = EnumMapper.mapPaymentType(createJobDto.payment_type);
    const jobType = EnumMapper.mapJobType(createJobDto.job_type);


    // Create the job data object
    const jobData: CreateJobDto = {
      title: createJobDto.title,
      category: category as any, // Use mapped category
      price: price,
      payment_type: paymentType as any, // Use mapped payment type
      job_type: jobType as any, // Use mapped job type
      location: createJobDto.location,
      latitude: latitude,
      longitude: longitude,
      start_time: createJobDto.start_time,
      end_time: createJobDto.end_time,
      description: createJobDto.description,
      requirements: requirements,
      notes: notes,
      urgent_note: createJobDto.urgent_note,
    };
    
    // Debug: Log the final job data being sent to service
    console.log('DEBUG - Final job data being sent to service:');
    console.log('DEBUG - Requirements in jobData:', jobData.requirements);
    console.log('DEBUG - Requirements type in jobData:', typeof jobData.requirements);
    console.log('DEBUG - Requirements length in jobData:', Array.isArray(jobData.requirements) ? jobData.requirements.length : 'not an array');
    console.log('DEBUG - Full jobData object:', JSON.stringify(jobData, null, 2));
    
    return this.jobService.create(jobData, userId, photoPaths);
  }

  @ApiOperation({ summary: 'Get all jobs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully', type: JobListResponseDto })
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

    const result = await this.jobService.findAll(
      parseInt(page),
      parseInt(limit),
      category as JobCategory,
      location,
      jobType,
      parsedPriceRange,
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
        totalPages: result.totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
    };
  }


  @ApiOperation({ summary: 'Get jobs posted by the current user' })
  @ApiResponse({ status: 200, description: 'User jobs retrieved successfully', type: JobListResponseDto })
  @Get('my-jobs')
  async findMyJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req: Request,
  ): Promise<JobListResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    const result = await this.jobService.findByUser(userId, parseInt(page), parseInt(limit));
    
    return {
      success: true,
      message: `Found ${result.jobs.length} of your jobs`,
      data: {
        jobs: result.jobs,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
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
      category as JobCategory,
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

  @ApiOperation({ summary: 'Mark job as completed (Helper only) - Returns time tracking data for hourly jobs' })
  @Patch(':id/complete')
  async completeJob(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return await this.jobService.completeJob(id, userId);
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

  @ApiOperation({ summary: 'Get upcoming appointments for user' })
  @ApiResponse({ status: 200, description: 'Upcoming appointments retrieved successfully' })
  @Get('appointments/upcoming')
  async getUpcomingAppointments(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const appointments = await this.jobService.getUpcomingAppointments(userId);
      return {
        success: true,
        message: 'Upcoming appointments retrieved successfully',
        data: appointments
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
  @Get('appointments/past')
  async getPastAppointments(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const appointments = await this.jobService.getPastAppointments(userId);
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

  @ApiOperation({ summary: 'Get upcoming appointments for helper' })
  @ApiResponse({ status: 200, description: 'Helper upcoming appointments retrieved successfully' })
  @Get('appointments/helper/upcoming')
  async getHelperUpcomingAppointments(@Req() req: Request) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      const appointments = await this.jobService.getHelperUpcomingAppointments(helperId);
      return {
        success: true,
        message: 'Helper upcoming appointments retrieved successfully',
        data: appointments
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get past appointments for helper' })
  @ApiResponse({ status: 200, description: 'Helper past appointments retrieved successfully' })
  @Get('appointments/helper/past')
  async getHelperPastAppointments(@Req() req: Request) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      const appointments = await this.jobService.getHelperPastAppointments(helperId);
      return {
        success: true,
        message: 'Helper past appointments retrieved successfully',
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

  @ApiOperation({ summary: 'Debug: Get all jobs for user (for troubleshooting)' })
  @ApiResponse({ status: 200, description: 'All jobs retrieved successfully' })
  @Get('debug/all-jobs')
  async getAllJobsForUser(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const allJobs = await this.jobService.getAllJobsForUser(userId);
      return {
        success: true,
        message: 'All jobs retrieved successfully',
        data: allJobs
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

}
