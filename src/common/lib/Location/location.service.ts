import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationService {
  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param lat1 Latitude of first point
   * @param lon1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lon2 Longitude of second point
   * @returns Distance in kilometers
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Check if a helper is within the specified distance from a job
   * @param jobLat Job latitude
   * @param jobLon Job longitude
   * @param helperLat Helper latitude
   * @param helperLon Helper longitude
   * @param maxDistanceKm Maximum distance in kilometers
   * @returns True if helper is within distance
   */
  isWithinDistance(
    jobLat: number,
    jobLon: number,
    helperLat: number,
    helperLon: number,
    maxDistanceKm: number
  ): boolean {
    const distance = this.calculateDistance(jobLat, jobLon, helperLat, helperLon);
    return distance <= maxDistanceKm;
  }

  /**
   * Get coordinates from address using a geocoding service
   * This is a placeholder - you can integrate with Google Maps API, OpenStreetMap, etc.
   * @param address Address string
   * @returns Promise with latitude and longitude
   */
  async getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // TODO: Integrate with geocoding service
    // For now, return null to indicate coordinates need to be provided manually
    console.log(`Geocoding not implemented yet. Address: ${address}`);
    return null;
  }

  /**
   * Validate if coordinates are valid
   * @param lat Latitude
   * @param lng Longitude
   * @returns True if coordinates are valid
   */
  isValidCoordinates(lat: number, lng: number): boolean {
    return (
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !isNaN(lat) && !isNaN(lng)
    );
  }
}
