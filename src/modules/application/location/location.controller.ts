import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LocationService } from './location.service';

@ApiBearerAuth()
@ApiTags('Location Services')
@UseGuards(JwtAuthGuard)
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @ApiOperation({ summary: 'Get location details from GPS coordinates' })
  @ApiQuery({ name: 'lat', description: 'Latitude coordinate', example: '40.7128' })
  @ApiQuery({ name: 'lng', description: 'Longitude coordinate', example: '-74.0060' })
  @Get('current')
  async getCurrentLocation(
    @Query('lat') lat: string,
    @Query('lng') lng: string
  ): Promise<{ 
    success: boolean; 
    location?: { 
      latitude: number; 
      longitude: number; 
      address: string; 
    }; 
    message: string 
  }> {
    try {
      console.log('Received parameters:', { lat, lng });
      console.log('Parameter types:', { latType: typeof lat, lngType: typeof lng });
      
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      console.log('Parsed coordinates:', { latitude, longitude });
      console.log('Is NaN check:', { latIsNaN: isNaN(latitude), lngIsNaN: isNaN(longitude) });

      if (isNaN(latitude) || isNaN(longitude)) {
        console.log('Invalid coordinates detected');
        return {
          success: false,
          message: 'Invalid coordinates provided. Please provide valid latitude and longitude values.'
        };
      }

      const locationData = await this.locationService.getCurrentLocation(latitude, longitude);
      
      if (locationData) {
        return {
          success: true,
          location: locationData,
          message: 'Successfully retrieved location details'
        };
      } else {
        return {
          success: false,
          message: 'Failed to retrieve location details for the provided coordinates'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Location error: ${error.message}`
      };
    }
  }

  @ApiOperation({ summary: 'Geocode an address to get coordinates' })
  @ApiQuery({ name: 'address', description: 'Address to geocode', example: 'New York, NY, USA' })
  @Get('geocode')
  async geocodeAddress(
    @Query('address') address: string
  ): Promise<{ 
    success: boolean; 
    coordinates?: { 
      latitude: number; 
      longitude: number; 
    }; 
    message: string 
  }> {
    try {
      if (!address || address.trim().length === 0) {
        return {
          success: false,
          message: 'Address is required'
        };
      }

      const coordinates = await this.locationService.geocodeAddress(address);
      
      if (coordinates) {
        return {
          success: true,
          coordinates: {
            latitude: coordinates.lat,
            longitude: coordinates.lng
          },
          message: `Successfully geocoded "${address}"`
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
}
