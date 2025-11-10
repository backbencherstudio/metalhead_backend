import {Controller,Get,Post,Body,Patch,Param,Delete,UseGuards,Query,UseInterceptors,UploadedFiles,Req,BadRequestException,Put,} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JobService } from './job.service';
import { JobNotificationService } from './job-notification.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { JobCreateResponseDto } from './dto/job-create-response.dto';
import { JobListResponseDto } from './dto/job-list-response.dto';
import { JobSingleResponseDto } from './dto/job-single-response.dto';
import { HelperPreferencesDto } from './dto/helper-preferences-shared.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { CategoryService } from '../category/category.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { collectPhotoPaths, normalizeCategory, normalizeCoordinates, normalizeEnum, parseJsonField } from './utils/parse-helper.util'
import { RequestExtraTimeDto } from './dto/request-extra-time.dto';
import { JobManageService } from './job-manage.service';

@ApiBearerAuth()
@ApiTags('Jobs')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobNotificationService: JobNotificationService,
    private readonly categoryService: CategoryService,
    private readonly jobManageService: JobManageService,
  ) {}

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
    const requirements = parseJsonField(createJobDto.requirements, [], 'requirements');
    const notes = parseJsonField(createJobDto.notes, [], 'notes');

    const photoPaths = await collectPhotoPaths(files);

    const { latitude, longitude } = normalizeCoordinates(createJobDto);
    const category = normalizeCategory(createJobDto.category);
    const paymentType = normalizeEnum(createJobDto.payment_type, ['HOURLY', 'FIXED'], 'payment_type');
    const jobType = normalizeEnum(createJobDto.job_type, ['URGENT', 'ANYTIME'], 'job_type');

    const jobData: CreateJobDto = {
      title: createJobDto.title,
      category: category as any,
      price: createJobDto.price,
      payment_type: paymentType as any,
      job_type: jobType as any,
      location: createJobDto.location,
      latitude,
      longitude,
      start_time: createJobDto.start_time,
      end_time: createJobDto.end_time,
      description: createJobDto.description,
      requirements,
      notes,
      urgent_note: createJobDto.urgent_note,
    };

    return this.jobService.create(jobData, userId, photoPaths);
  }


  @ApiOperation({ 
    summary: 'Ultra-Dynamic Job Search API (Common for Users and Helpers)',
    description: 'Single API for ALL job searching needs - supports ANY combination of filters. Each parameter is optional - use any combination you need for dynamic filtering. For helpers, preference settings (max_distance_km, preferred_categories, min_job_price, max_job_price) are automatically applied when filters are not provided.'
  })
  @Get()
  async searchJobs(
    @Req() req: Request,
    @Query() query: SearchJobsDto,
  ): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    const result = await this.jobService.searchJobsWithValidation(query, userId);

    return {
      success: true,
      message: `Found ${result.jobs.length} jobs`,
      preferenceMessage: (result as any).preferenceMessage || '',
      data: result.jobs,
      
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    };
  }


  @ApiOperation({ summary: 'Get jobs posted by the current user (no pagination - Flutter handles pagination)' })
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
        totalPages: 1,
        currentPage: 1,
      },
    };
  }

  @ApiOperation({ summary: 'Get latest upcoming appointment for user' })
  @Get('upcoming')
  async getLatestAppointment(@Req() req: Request) {
    const userId = req.user.userId
    const userType=(req as any).user.type;
    const latestJob = await this.jobService.upcomingEvents(userId,userType);
    
    return {
      success: true,
      message: latestJob.message,
      data: latestJob.data,
    };
  }


  @ApiOperation({ summary: 'Get all available job categories' })
  @Get('categories')
  async getCategories() {
    return await this.categoryService.getCategoriesWithCounts();
  }

  @ApiOperation({ summary: 'Get job counts by category' })
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
  @Get('categories/:category')
  async getCategoryDetails(@Param('category') category: string): Promise<CategoryResponseDto> {
    const categoryRecord = await this.categoryService.getCategoryById(category);
    if (!categoryRecord) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }

    return {
      key: categoryRecord.name,
      label: categoryRecord.label,
      description: categoryRecord.label, // Using label as description for now
    };
  }

  // Note: Use the main /api/jobs endpoint with category filter instead of this endpoint

  
  @ApiOperation({ summary: 'Get a specific job by ID' })
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

    const requirements = parseJsonField(updateJobDto?.requirements, [], 'requirements');
    const notes = parseJsonField(updateJobDto?.notes, [], 'notes');

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
  @Patch('startOrComplete/:id')
  async startJob(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const helperId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.startOrCompleteJob(id, helperId);
  }

  @ApiOperation({ summary: 'Mark job as finished and release payment (User only)' })
  @Patch('finish/:id')
  async finishJob(@Param('id') id: string, @Req() req: Request): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.finishJob(id, userId);
  }

  @Get('timeline/:id')
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

  @ApiOperation({ summary: 'Get saved preferences' })
  @Get('settings/preferences')
  async getPreferences(@Req() req: Request): Promise<{
    success: boolean;
    message: string;
    data: {
      maxDistanceKm?: number;
      latitude?: number;
      longitude?: number;
      preferredCategoryIds?: Array<{
        id: string;
        category: string;
        label: string;
      }>;
    };
  }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    const preferences = await this.jobService.getUserPreferences(userId);
    
    return {
      success: true,
      message: 'Preferences retrieved successfully',
      data: preferences,
    };
  }


  @ApiOperation({ summary: 'Update helper notification preferences' })
  @Patch('settings/update-preferences')
  async updateHelperPreferences(
    @Body() dto: HelperPreferencesDto,
    @Req() req: Request,
  ): Promise<any> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.jobService.updateHelperPreferences(userId, dto);
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


  @ApiOperation({ summary: 'Get weekly earnings breakdown with day-by-day chart' })
  @Get('earnings/weekly')
  async getWeeklyEarnings(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const userType = (req as any).user.type;
      const weeklyData = await this.jobService.getWeeklyEarnings(userId, userType);
      return {
        success: true,
        message: 'Weekly earnings fetched successfully',
        data: weeklyData
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Put('approveOrRejectExtratime/:id')
  @UseGuards(JwtAuthGuard)
  async approveOrDeclineExtraTime(
    @Param('id') jobId: string,
    @Req() req: Request,
    @Body() body: { approved: boolean },
  ) {
    const userId = req.user.userId;
    return this.jobService.approveOrDeclineExtraTime(jobId, userId, body.approved);
  }
  // ===== JOB STATUS MANAGEMENT ENDPOINTS =====
  /**
   * Cancel a job
   */
  @Delete('cancel/:id')
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
  @Post('add-time/:id')
  async requestExtraTime(
    @Param('id') jobId: string,
    @Body() dto: RequestExtraTimeDto,
    @Req() req: Request,
  ) {
    const userId = req.user.userId || req.user.id;  // ✅ Consistent user ID
    return this.jobService.requestExtraTime(jobId, userId, dto);
  }
  /**
   * Get job status for timeline
   */
  @ApiOperation({ summary: 'Get job status for timeline display' })
  @Get(':id/status')
  async getJobStatus(
    @Param('id') jobId: string,
    @Req() req: Request,
  ) {
    const userId = req.user.userId;
    return this.jobService.getJobStatus(jobId, userId);
  }

  // @ApiOperation({ summary: 'Test endpoint - Manually trigger auto-complete cron job' })
  // @ApiResponse({ status: 200, description: 'Cron job executed successfully' })
  // @Get('test-auto-complete')
  // async testAutoComplete(@Req() req: Request): Promise<any> {
  //   console.log('[TEST] Manually triggering auto-complete cron job');
  //   return await this.jobService.checkAndAutoCompleteJobs();
  // }
  @Get('stats/user-details')
  async getUserDetailsAndJobs(@Req() req: Request, @Query('days') days: number) {
    const userId = req.user.userId;
    return this.jobManageService.getUserDetailsAndJobs(userId,days);
  }
  //route: jobs/stats/user-details?days=7
}
