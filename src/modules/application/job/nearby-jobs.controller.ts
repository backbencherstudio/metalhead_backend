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
import { NearbyJobsService } from './nearby-jobs.service';
import { HelperPreferencesDto, HelperPreferencesResponse } from './dto/helper-preferences-shared.dto';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Nearby Jobs & Notifications')
@UseGuards(JwtAuthGuard)
@Controller('nearby-jobs')
export class NearbyJobsController {
  constructor(private readonly nearbyJobsService: NearbyJobsService) {}

 
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
      const userId = (req as any).user.userId
      
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


  @Get('preferences')
  async getNotificationPreferences(@Req() req: Request): Promise<HelperPreferencesResponse> {
      const userId = (req as any).user.userId
      return this.nearbyJobsService.getHelperNotificationPreferences(userId);
  }


  @Put('preferences')
  async updateNotificationPreferences(
    @Body() preferences: HelperPreferencesDto,
    @Req() req: Request,
  ) {
      const userId = (req as any).user.userId;
      await this.nearbyJobsService.updateHelperNotificationPreferences(userId, preferences);
  }


  // Note: Use the main /api/nearby-jobs endpoint with lat/lng parameters instead of separate endpoints
}
