import { Injectable } from '@nestjs/common';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';

@Injectable()
export class LocationService {
  constructor(private readonly geocodingService: GeocodingService) {}

  /**
   * Get current location details from coordinates
   * Converts GPS coordinates to a readable address
   */
  async getCurrentLocation(latitude: number, longitude: number): Promise<{ 
    latitude: number; 
    longitude: number; 
    address: string; 
  } | null> {
    try {
      // Use reverse geocoding to get address from coordinates
      const address = await this.geocodingService.reverseGeocode(latitude, longitude);
      
      if (address) {
        return {
          latitude,
          longitude,
          address
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Geocode an address to get coordinates
   * Converts a readable address to GPS coordinates
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      return await this.geocodingService.geocodeAddress(address);
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }
}
