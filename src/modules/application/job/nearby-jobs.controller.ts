import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Query, 
  UseGuards, 
  Req,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NearbyJobsService, HelperNotificationPreferences } from './nearby-jobs.service';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Nearby Jobs & Notifications')
@UseGuards(JwtAuthGuard)
@Controller('nearby-jobs')
export class NearbyJobsController {
  constructor(private readonly nearbyJobsService: NearbyJobsService) {}

  @ApiOperation({ 
    summary: 'Comprehensive Nearby Jobs API (Common for Users and Helpers)',
    description: 'Single API for all nearby job searching needs - supports location-based search, filtering, sorting, and pagination. Use this for all nearby job discovery needs.'
  })
  @ApiQuery({ name: 'page', description: 'Page number', example: '1', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', example: '10', required: false })
  
  // Location-based search (either use user's location or provide coordinates)
  @ApiQuery({ name: 'lat', description: 'Latitude for location-based search', example: '40.7128', required: false })
  @ApiQuery({ name: 'lng', description: 'Longitude for location-based search', example: '-74.0060', required: false })
  @ApiQuery({ name: 'maxDistanceKm', description: 'Maximum distance in kilometers', example: '25', required: false })
  
  // Job filters
  @ApiQuery({ name: 'category', description: 'Job category', example: 'cleaning', required: false })
  @ApiQuery({ name: 'jobType', description: 'Job type: URGENT or ANYTIME', example: 'URGENT', required: false })
  @ApiQuery({ name: 'paymentType', description: 'Payment type: HOURLY or FIXED', example: 'HOURLY', required: false })
  @ApiQuery({ name: 'jobStatus', description: 'Job status', example: 'posted', required: false })
  @ApiQuery({ name: 'minPrice', description: 'Minimum job price', example: '100', required: false })
  @ApiQuery({ name: 'maxPrice', description: 'Maximum job price', example: '1000', required: false })
  @ApiQuery({ name: 'categories', description: 'Job categories (comma-separated)', example: 'cleaning,technology', required: false })
  
  // Search & Sort
  @ApiQuery({ name: 'search', description: 'Search in title and description', example: 'plumbing repair', required: false })
  @ApiQuery({ name: 'sortBy', description: 'Sort by: distance, price, date, urgency_recent', example: 'distance', required: false })
  @Get()
  async searchNearbyJobs(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
    @Query('category') category?: string,
    @Query('jobType') jobType?: string,
    @Query('paymentType') paymentType?: string,
    @Query('jobStatus') jobStatus?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('categories') categories?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      
      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in request',
        };
      }

      // Parse pagination parameters
      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 10;
      
      // Parse location parameters
      const searchLat = lat ? parseFloat(lat) : undefined;
      const searchLng = lng ? parseFloat(lng) : undefined;
      const maxDistance = maxDistanceKm ? parseFloat(maxDistanceKm) : 25;
      
      // Parse filter parameters
      const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
      const maxPriceNum = maxPrice ? parseFloat(maxPrice) : undefined;
      const categoriesArray = categories ? categories.split(',').map(c => c.trim()) : undefined;
      const sortByValue = sortBy as 'distance' | 'price' | 'date' | 'urgency_recent' || 'distance';

      const result = await this.nearbyJobsService.searchNearbyJobsWithPagination(
        userId,
        {
          searchLat,
          searchLng,
          maxDistanceKm: maxDistance,
          category,
          jobType,
          paymentType,
          jobStatus,
          minPrice: minPriceNum,
          maxPrice: maxPriceNum,
          categories: categoriesArray,
          search,
          sortBy: sortByValue,
        },
        pageNum,
        limitNum,
      );

      return {
        success: true,
        data: result,
        message: `Found ${result.jobs.length} nearby jobs`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ 
    summary: 'Get notification preferences (Common for Users and Helpers)',
    description: 'Get the current notification preferences for a user/helper including distance, price range, and preferred categories.'
  })
  @Get('preferences')
  async getNotificationPreferences(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      
      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in request',
        };
      }

      const preferences = await this.nearbyJobsService.getHelperNotificationPreferences(userId);

      return {
        success: true,
        data: preferences,
        message: 'Notification preferences retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ 
    summary: 'Update notification preferences (Common for Users and Helpers)',
    description: 'Update the notification preferences for a user/helper including maximum distance, price range, and preferred categories.'
  })
  @ApiBody({
    description: 'Helper notification preferences',
    schema: {
      type: 'object',
      properties: {
        maxDistanceKm: { type: 'number', example: 25, description: 'Maximum distance in kilometers' },
        minJobPrice: { type: 'number', example: 100, description: 'Minimum job price to get notified' },
        maxJobPrice: { type: 'number', example: 1000, description: 'Maximum job price to get notified' },
        preferredCategories: { 
          type: 'array', 
          items: { type: 'string' }, 
          example: ['Technology', 'Photography', 'Design'],
          description: 'Job categories helper wants to be notified about'
        },
        isActive: { type: 'boolean', example: true, description: 'Whether notifications are active' },
        notificationTypes: { 
          type: 'array', 
          items: { type: 'string' }, 
          example: ['new_job'],
          description: 'Types of notifications to receive'
        }
      }
    }
  })
  @Put('preferences')
  async updateNotificationPreferences(
    @Body() preferences: Partial<HelperNotificationPreferences>,
    @Req() req: Request,
  ) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      
      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in request',
        };
      }

      await this.nearbyJobsService.updateHelperNotificationPreferences(userId, preferences);

      return {
        success: true,
        message: 'Notification preferences updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  // Note: Use the main /api/nearby-jobs endpoint with lat/lng parameters instead of separate endpoints
}
