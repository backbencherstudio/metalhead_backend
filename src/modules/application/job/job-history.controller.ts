import { Controller, Get, Query, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JobHistoryService, JobHistoryFilters } from './job-history.service';

@ApiBearerAuth()
@ApiTags('Job History & Filtering')
@UseGuards(JwtAuthGuard)
@Controller('job-history')
export class JobHistoryController {
  private readonly logger = new Logger(JobHistoryController.name);

  constructor(private readonly jobHistoryService: JobHistoryService) {}

  @ApiOperation({ summary: 'Get user job history (posted jobs)' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'posted,confirmed,completed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', example: 'date_newest' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'User job history retrieved successfully' })
  @Get('user')
  async getUserJobHistory(
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      
      const filters: JobHistoryFilters = {
        userId,
        status: status ? status.split(',').map(s => s.trim()) : [],
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy as any || 'date_newest',
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getUserJobHistory(filters);
      
      return {
        success: true,
        message: 'User job history retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting user job history: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get helper job history (accepted jobs)' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'confirmed,ongoing,completed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', example: 'date_newest' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Helper job history retrieved successfully' })
  @Get('helper')
  async getHelperJobHistory(
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any
  ) {
    try {
      const helperId = req.user.userId || req.user.id;
      
      const filters: JobHistoryFilters = {
        helperId,
        status: status ? status.split(',').map(s => s.trim()) : [],
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy as any || 'date_newest',
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getHelperJobHistory(filters);
      
      return {
        success: true,
        message: 'Helper job history retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting helper job history: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get nearest jobs based on user location' })
  @ApiQuery({ name: 'lat', required: true, description: 'User latitude', example: '40.7128' })
  @ApiQuery({ name: 'lng', required: true, description: 'User longitude', example: '-74.0060' })
  @ApiQuery({ name: 'maxDistanceKm', required: false, description: 'Maximum distance in kilometers', example: '50' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'posted,confirmed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Nearest jobs retrieved successfully' })
  @Get('nearest')
  async getNearestJobs(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters: JobHistoryFilters = {
        userLatitude: parseFloat(lat),
        userLongitude: parseFloat(lng),
        maxDistanceKm: maxDistanceKm ? parseFloat(maxDistanceKm) : 50,
        status: status ? status.split(',').map(s => s.trim()) : [],
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getNearestJobs(filters);
      
      return {
        success: true,
        message: 'Nearest jobs retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting nearest jobs: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get jobs sorted by best ratings' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'posted,confirmed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Best rated jobs retrieved successfully' })
  @Get('best-rated')
  async getBestRatedJobs(
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters: JobHistoryFilters = {
        status: status ? status.split(',').map(s => s.trim()) : [],
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getBestRatedJobs(filters);
      
      return {
        success: true,
        message: 'Best rated jobs retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting best rated jobs: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get jobs filtered by price range' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', example: 'price_low_high' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'posted,confirmed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Jobs filtered by price range retrieved successfully' })
  @Get('price-range')
  async getJobsByPriceRange(
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters: JobHistoryFilters = {
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy as any || 'price_low_high',
        status: status ? status.split(',').map(s => s.trim()) : [],
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getJobsByPriceRange(filters);
      
      return {
        success: true,
        message: 'Jobs filtered by price range retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting jobs by price range: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get jobs filtered by status' })
  @ApiQuery({ name: 'status', required: true, description: 'Job status filter (comma-separated)', example: 'posted,counter_offer,confirmed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', example: 'date_newest' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Jobs filtered by status retrieved successfully' })
  @Get('status')
  async getJobsByStatus(
    @Query('status') status: string,
    @Query('jobType') jobType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters: JobHistoryFilters = {
        status: status.split(',').map(s => s.trim()),
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy as any || 'date_newest',
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getJobsByStatus(filters);
      
      return {
        success: true,
        message: 'Jobs filtered by status retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting jobs by status: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get jobs filtered by type/category' })
  @ApiQuery({ name: 'jobType', required: true, description: 'Job type filter (comma-separated)', example: 'Technology,Photography,Design' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'posted,confirmed' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', example: 'date_newest' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Jobs filtered by type retrieved successfully' })
  @Get('type')
  async getJobsByType(
    @Query('jobType') jobType: string,
    @Query('status') status?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters: JobHistoryFilters = {
        jobType: jobType.split(',').map(t => t.trim()),
        status: status ? status.split(',').map(s => s.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy as any || 'date_newest',
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      const result = await this.jobHistoryService.getJobsByType(filters);
      
      return {
        success: true,
        message: 'Jobs filtered by type retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error getting jobs by type: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @ApiOperation({ summary: 'Get comprehensive job search with multiple filters' })
  @ApiQuery({ name: 'status', required: false, description: 'Job status filter (comma-separated)', example: 'posted,confirmed' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Job type filter (comma-separated)', example: 'Technology,Photography' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter', example: '100' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter', example: '1000' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', example: 'date_newest' })
  @ApiQuery({ name: 'lat', required: false, description: 'User latitude for distance filtering', example: '40.7128' })
  @ApiQuery({ name: 'lng', required: false, description: 'User longitude for distance filtering', example: '-74.0060' })
  @ApiQuery({ name: 'maxDistanceKm', required: false, description: 'Maximum distance in kilometers', example: '50' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: '10' })
  @ApiResponse({ status: 200, description: 'Comprehensive job search completed successfully' })
  @Get('search')
  async getComprehensiveJobSearch(
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const filters: JobHistoryFilters = {
        status: status ? status.split(',').map(s => s.trim()) : [],
        jobType: jobType ? jobType.split(',').map(t => t.trim()) : [],
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy as any || 'date_newest',
        userLatitude: lat ? parseFloat(lat) : undefined,
        userLongitude: lng ? parseFloat(lng) : undefined,
        maxDistanceKm: maxDistanceKm ? parseFloat(maxDistanceKm) : undefined,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10
      };

      // If location is provided, use nearest jobs service
      if (filters.userLatitude && filters.userLongitude) {
        const result = await this.jobHistoryService.getNearestJobs(filters);
        return {
          success: true,
          message: 'Comprehensive job search with location completed successfully',
          data: result
        };
      }

      // Otherwise, use general job search
      const result = await this.jobHistoryService.getJobsByStatus(filters);
      
      return {
        success: true,
        message: 'Comprehensive job search completed successfully',
        data: result
      };
    } catch (error) {
      this.logger.error(`Error in comprehensive job search: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message
      };
    }
  }
}


