import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';

@Injectable()
export class HelperLocationService {
  constructor(
    private prisma: PrismaService,
    private geocodingService: GeocodingService
  ) {}

  /**
   * Update helper's location with automatic geocoding
   */
  async updateHelperLocation(
    helperId: string,
    locationData: {
      city?: string;
      state?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<{ success: boolean; message: string; coordinates?: { lat: number; lng: number } }> {
    try {
      // Check if helper exists
      const helper = await this.prisma.user.findUnique({
        where: { id: helperId },
        select: { id: true, type: true },
      });

      if (!helper) {
        return { success: false, message: 'Helper not found' };
      }

      if (helper.type !== 'helper') {
        return { success: false, message: 'Only helpers can update location' };
      }

      let coordinates = null;

      // If coordinates are provided, use them directly
      if (locationData.latitude && locationData.longitude) {
        coordinates = {
          lat: locationData.latitude,
          lng: locationData.longitude,
        };
      } else {
        // Try to geocode from address or city/state
        let addressToGeocode = '';

        if (locationData.address) {
          addressToGeocode = locationData.address;
        } else if (locationData.city && locationData.state) {
          addressToGeocode = `${locationData.city}, ${locationData.state}`;
        } else if (locationData.city) {
          addressToGeocode = locationData.city;
        }

        if (addressToGeocode) {
          console.log(`🌍 Auto-geocoding helper location: "${addressToGeocode}"`);
          coordinates = await this.geocodingService.geocodeAddress(addressToGeocode);
          
          if (coordinates) {
            console.log(`✅ Helper geocoding successful: (${coordinates.lat}, ${coordinates.lng})`);
          } else {
            console.log(`❌ Helper geocoding failed for location: "${addressToGeocode}"`);
          }
        }
      }

      // Update helper's location data
      const updateData: any = {};
      
      if (locationData.city) updateData.city = locationData.city;
      if (locationData.state) updateData.state = locationData.state;
      if (locationData.address) updateData.address = locationData.address;
      
      if (coordinates) {
        updateData.latitude = coordinates.lat;
        updateData.longitude = coordinates.lng;
      }

      await this.prisma.user.update({
        where: { id: helperId },
        data: updateData,
      });

      return {
        success: true,
        message: coordinates 
          ? 'Location updated successfully with coordinates'
          : 'Location updated successfully (coordinates not available)',
        coordinates,
      };
    } catch (error) {
      console.error('Failed to update helper location:', error);
      return { success: false, message: `Failed to update location: ${error.message}` };
    }
  }

  /**
   * Batch update locations for multiple helpers
   */
  async batchUpdateHelperLocations(
    updates: Array<{
      helperId: string;
      city?: string;
      state?: string;
      address?: string;
    }>
  ): Promise<Array<{ helperId: string; success: boolean; message: string; coordinates?: { lat: number; lng: number } }>> {
    const results = [];

    for (const update of updates) {
      const result = await this.updateHelperLocation(update.helperId, update);
      results.push({
        helperId: update.helperId,
        ...result,
      });

      // Add delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Get helper's current location info
   */
  async getHelperLocation(helperId: string): Promise<{
    city?: string;
    state?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    hasCoordinates: boolean;
  }> {
    const helper = await this.prisma.user.findUnique({
      where: { id: helperId },
      select: {
        city: true,
        state: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!helper) {
      throw new Error('Helper not found');
    }

    return {
      city: helper.city,
      state: helper.state,
      address: helper.address,
      latitude: helper.latitude,
      longitude: helper.longitude,
      hasCoordinates: !!(helper.latitude && helper.longitude),
    };
  }
}
