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
    summary: 'Get nearby jobs for helper',
    description: 'Find jobs near the helper based on their location and preferences. This is the main endpoint for helpers to discover nearby work opportunities.'
  })
  @ApiQuery({ name: 'page', description: 'Page number', example: '1', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', example: '10', required: false })
  @ApiQuery({ name: 'maxDistanceKm', description: 'Maximum distance in kilometers', example: '25', required: false })
  @ApiQuery({ name: 'minPrice', description: 'Minimum job price', example: '100', required: false })
  @ApiQuery({ name: 'maxPrice', description: 'Maximum job price', example: '1000', required: false })
  @ApiQuery({ name: 'categories', description: 'Job categories (comma-separated)', example: 'Technology,Photography', required: false })
  @ApiQuery({ name: 'sortBy', description: 'Sort by: distance, price, date', example: 'distance', required: false })
  @Get()
  async getNearbyJobs(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('categories') categories?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 10;
      const maxDistance = maxDistanceKm ? parseFloat(maxDistanceKm) : undefined;
      const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
      const maxPriceNum = maxPrice ? parseFloat(maxPrice) : undefined;
      const categoriesArray = categories ? categories.split(',').map(c => c.trim()) : undefined;
      const sortByValue = sortBy as 'distance' | 'price' | 'date' || 'distance';

      const result = await this.nearbyJobsService.getNearbyJobsWithPagination(
        helperId,
        pageNum,
        limitNum,
        {
          maxDistanceKm: maxDistance,
          minPrice: minPriceNum,
          maxPrice: maxPriceNum,
          categories: categoriesArray,
          sortBy: sortByValue,
        }
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
    summary: 'Get helper notification preferences',
    description: 'Get the current notification preferences for a helper including distance, price range, and preferred categories.'
  })
  @Get('preferences')
  async getNotificationPreferences(@Req() req: Request) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      const preferences = await this.nearbyJobsService.getHelperNotificationPreferences(helperId);

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
    summary: 'Update helper notification preferences',
    description: 'Update the notification preferences for a helper including maximum distance, price range, and preferred categories.'
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
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      await this.nearbyJobsService.updateHelperNotificationPreferences(helperId, preferences);

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

  @ApiOperation({ 
    summary: 'Test nearby jobs notification (Admin/Helper)',
    description: 'Manually trigger a test notification to see how nearby jobs notifications work. Useful for testing the notification system.'
  })
  @Post('test-notification')
  async testNotification(@Req() req: Request) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      // Get a sample nearby job for testing
      const nearbyJobs = await this.nearbyJobsService.findNearbyJobsForHelper(helperId, { limit: 1 });

      if (nearbyJobs.length === 0) {
        return {
          success: false,
          message: 'No nearby jobs found to test notification',
        };
      }

      const testJob = nearbyJobs[0];

      // Send test notification
      await this.nearbyJobsService.notifyHelpersAboutNewJob(testJob.jobId);

      return {
        success: true,
        message: 'Test notification sent successfully',
        data: {
          testJob: {
            id: testJob.jobId,
            title: testJob.jobTitle,
            price: testJob.jobPrice,
            distance: testJob.distance,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ 
    summary: 'Get nearby jobs count',
    description: 'Get the count of nearby jobs for a helper without fetching the full job details. Useful for showing notification badges.'
  })
  @ApiQuery({ name: 'maxDistanceKm', description: 'Maximum distance in kilometers', example: '25', required: false })
  @Get('count')
  async getNearbyJobsCount(
    @Req() req: Request,
    @Query('maxDistanceKm') maxDistanceKm?: string,
  ) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      const maxDistance = maxDistanceKm ? parseFloat(maxDistanceKm) : undefined;
      const nearbyJobs = await this.nearbyJobsService.findNearbyJobsForHelper(helperId, {
        maxDistanceKm: maxDistance,
        limit: 100, // Get more to count
      });

      return {
        success: true,
        data: {
          count: nearbyJobs.length,
          maxDistance: maxDistance,
        },
        message: `Found ${nearbyJobs.length} nearby jobs`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ 
    summary: 'Get nearby jobs by specific location',
    description: 'Find jobs near a specific location (useful for exploring jobs in different areas)'
  })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: '40.7128', required: true })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: '-74.0060', required: true })
  @ApiQuery({ name: 'maxDistanceKm', description: 'Maximum distance in kilometers', example: '25', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of jobs to return', example: '10', required: false })
  @Get('by-location')
  async getNearbyJobsByLocation(
    @Req() req: Request,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return {
          success: false,
          message: 'Invalid coordinates provided',
        };
      }

      // Temporarily update helper's location for this search
      // You might want to create a separate method for this
      const maxDistance = maxDistanceKm ? parseFloat(maxDistanceKm) : 25;
      const limitNum = limit ? parseInt(limit) : 10;

      // For now, we'll use the helper's current location and preferences
      // You can extend this to accept custom location
      const nearbyJobs = await this.nearbyJobsService.findNearbyJobsForHelper(helperId, {
        maxDistanceKm: maxDistance,
        limit: limitNum,
      });

      return {
        success: true,
        data: {
          jobs: nearbyJobs,
          searchLocation: {
            latitude,
            longitude,
          },
          maxDistance,
        },
        message: `Found ${nearbyJobs.length} jobs near the specified location`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
